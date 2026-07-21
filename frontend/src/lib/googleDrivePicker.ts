const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type TokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void;
};

type PickerDoc = {
  id: string;
  name: string;
  mimeType?: string;
};

type GooglePickerNs = {
  Action: { PICKED: string; CANCEL: string };
  DocsViewMode: { LIST: unknown };
  Feature: { MULTISELECT_ENABLED: unknown; SUPPORT_DRIVES: unknown };
  ViewId: { DOCS: unknown };
  DocsView: new (viewId?: unknown) => {
    setIncludeFolders: (v: boolean) => unknown;
    setSelectFolderEnabled: (v: boolean) => unknown;
    setMode: (mode: unknown) => unknown;
  };
  PickerBuilder: new () => {
    addView: (view: unknown) => GooglePickerBuilder;
    setOAuthToken: (token: string) => GooglePickerBuilder;
    setDeveloperKey: (key: string) => GooglePickerBuilder;
    setCallback: (
      cb: (data: { action: string; docs?: PickerDoc[] }) => void,
    ) => GooglePickerBuilder;
    enableFeature: (f: unknown) => GooglePickerBuilder;
    setTitle: (t: string) => GooglePickerBuilder;
    build: () => { setVisible: (v: boolean) => void };
  };
};

type GooglePickerBuilder = InstanceType<GooglePickerNs["PickerBuilder"]>;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: {
              access_token?: string;
              error?: string;
            }) => void;
          }) => TokenClient;
        };
      };
      picker: GooglePickerNs;
    };
    gapi?: {
      load: (name: string, cb: () => void) => void;
    };
  }
}

function getConfig() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim() ?? "";
  return { clientId, apiKey };
}

/** True when Picker env vars are set (popup select works). */
export function isGoogleDrivePickerConfigured(): boolean {
  const { clientId, apiKey } = getConfig();
  return Boolean(clientId && apiKey);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => {
      el.dataset.loaded = "1";
      resolve();
    };
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

async function ensureApis(): Promise<void> {
  await Promise.all([loadScript(GIS_SRC), loadScript(GAPI_SRC)]);
  await new Promise<void>((resolve, reject) => {
    if (!window.gapi?.load) {
      reject(new Error("Google API client failed to load"));
      return;
    }
    window.gapi.load("picker", () => resolve());
  });
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services failed to load"));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "Google Drive auth cancelled"));
          return;
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

function openPicker(accessToken: string, apiKey: string): Promise<PickerDoc[]> {
  return new Promise((resolve, reject) => {
    const g = window.google;
    if (!g?.picker) {
      reject(new Error("Google Picker failed to load"));
      return;
    }

    const view = new g.picker.DocsView(g.picker.ViewId.DOCS);
    view.setIncludeFolders(true);
    view.setSelectFolderEnabled(false);
    view.setMode(g.picker.DocsViewMode.LIST);

    const picker = new g.picker.PickerBuilder()
      .addView(view)
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(g.picker.Feature.SUPPORT_DRIVES)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setTitle("Import to Engram")
      .setCallback((data) => {
        if (data.action === g.picker.Action.CANCEL) {
          resolve([]);
          return;
        }
        if (data.action === g.picker.Action.PICKED) {
          resolve(data.docs ?? []);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

async function downloadDriveFile(
  doc: PickerDoc,
  accessToken: string,
): Promise<File> {
  const metaResp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?fields=id,name,mimeType,size`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!metaResp.ok) {
    throw new Error(`Drive metadata failed (${metaResp.status})`);
  }
  const meta = (await metaResp.json()) as {
    name?: string;
    mimeType?: string;
  };

  const mime = meta.mimeType || doc.mimeType || "application/octet-stream";
  const name = meta.name || doc.name || "drive-file";

  const exportMap: Record<string, { mime: string; ext: string }> = {
    "application/vnd.google-apps.document": {
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
    },
    "application/vnd.google-apps.spreadsheet": {
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ext: "xlsx",
    },
    "application/vnd.google-apps.presentation": {
      mime: "application/pdf",
      ext: "pdf",
    },
  };

  let url: string;
  let outMime = mime;
  let outName = name;

  const exportSpec = exportMap[mime];
  if (exportSpec) {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}/export?mimeType=${encodeURIComponent(exportSpec.mime)}`;
    outMime = exportSpec.mime;
    if (!outName.includes(".")) outName = `${outName}.${exportSpec.ext}`;
  } else if (mime.startsWith("application/vnd.google-apps.")) {
    throw new Error(`Unsupported Google file type: ${name}`);
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media`;
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    throw new Error(`Drive download failed for ${name} (${resp.status})`);
  }
  const blob = await resp.blob();
  return new File([blob], outName, { type: outMime });
}

/**
 * Opens the official Google Drive Picker popup.
 * Returns selected files, or [] if cancelled.
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID + NEXT_PUBLIC_GOOGLE_API_KEY.
 */
export async function pickGoogleDriveFiles(): Promise<File[]> {
  const { clientId, apiKey } = getConfig();
  if (!clientId || !apiKey) {
    throw new Error(
      "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY to use Drive picker",
    );
  }

  await ensureApis();
  const token = await requestAccessToken(clientId);
  const docs = await openPicker(token, apiKey);
  if (!docs.length) return [];

  const files: File[] = [];
  for (const doc of docs) {
    files.push(await downloadDriveFile(doc, token));
  }
  return files;
}
