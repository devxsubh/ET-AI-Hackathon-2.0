"use client";

import { useRef, useState } from "react";
import { PlusIcon, Upload, LayoutGridIcon, Loader2Icon, Link2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    uploadStandaloneDocument,
    uploadStandaloneDocumentFromUrl,
} from "@/app/lib/rtpGlobalApi";
import {
    uploadRagDocument,
    uploadRagDocumentFromUrl,
    type RagDocumentRecord,
} from "@/lib/startupsApi";
import { GoogleDriveIcon } from "@/app/components/icons/GoogleDriveIcon";
import {
  isGoogleDrivePickerConfigured,
  pickGoogleDriveFiles,
} from "@/lib/googleDrivePicker";
import type { RtpDocument } from "../shared/types";

function ragDocToRtp(doc: RagDocumentRecord): RtpDocument {
    const ext = doc.filename.split(".").pop()?.toLowerCase() ?? "";
    const file_type =
        ext === "pdf" ? "pdf" : ext === "docx" || ext === "doc" ? "docx" : ext;
    return {
        id: doc.id,
        project_id: null,
        filename: doc.filename,
        file_type,
        storage_path: null,
        pdf_storage_path: null,
        size_bytes: doc.sizeBytes,
        page_count: null,
        structure_tree: null,
        status:
            doc.status === "ready"
                ? "ready"
                : doc.status === "processing"
                  ? "processing"
                  : "error",
        created_at: doc.uploadedAt,
    };
}

function isCsvFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
        name.endsWith(".csv") ||
        file.type === "text/csv" ||
        file.type === "application/vnd.ms-excel"
    );
}

interface Props {
    onSelectDoc: (doc: RtpDocument) => void;
    onSelectCsvFile?: (file: File) => void;
    onBrowseAll: () => void;
    selectedDocIds?: string[];
    attachmentCount?: number;
    /** When set, uploads go to startup RAG storage instead of standalone docs. */
    startupId?: string;
}

export function AddDocButton({
    onSelectDoc,
    onSelectCsvFile,
    onBrowseAll,
    selectedDocIds = [],
    attachmentCount,
    startupId,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [linkOpen, setLinkOpen] = useState<"drive" | "url" | null>(null);
    const [linkValue, setLinkValue] = useState("");
    const [linkError, setLinkError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const count = attachmentCount ?? selectedDocIds.length;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const csvFiles = files.filter(isCsvFile);
        const docFiles = files.filter((f) => !isCsvFile(f));

        csvFiles.forEach((f) => onSelectCsvFile?.(f));

        if (docFiles.length === 0) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setUploading(true);
        try {
            const uploaded = await Promise.all(
                docFiles.map((f) =>
                    startupId
                        ? uploadRagDocument(startupId, f).then(ragDocToRtp)
                        : uploadStandaloneDocument(f),
                ),
            );
            uploaded.forEach((doc) => onSelectDoc(doc));
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    async function importFromLink() {
        const url = linkValue.trim();
        if (!url) return;
        setUploading(true);
        setLinkError(null);
        try {
            const doc = startupId
                ? ragDocToRtp(
                      await uploadRagDocumentFromUrl(startupId, url),
                  )
                : await uploadStandaloneDocumentFromUrl(url);
            onSelectDoc(doc);
            setLinkOpen(null);
            setLinkValue("");
        } catch (err) {
            setLinkError(
                err instanceof Error ? err.message : "Import failed",
            );
        } finally {
            setUploading(false);
        }
    }

    async function importFromDrivePicker() {
        setUploading(true);
        setLinkError(null);
        try {
            const files = await pickGoogleDriveFiles();
            if (!files.length) return;
            for (const file of files) {
                if (isCsvFile(file)) {
                    onSelectCsvFile?.(file);
                    continue;
                }
                const doc = startupId
                    ? ragDocToRtp(await uploadRagDocument(startupId, file))
                    : await uploadStandaloneDocument(file);
                onSelectDoc(doc);
            }
        } catch (err) {
            setLinkError(
                err instanceof Error ? err.message : "Drive import failed",
            );
            // Fall back to paste-link UI if picker env/auth fails
            setLinkOpen("drive");
        } finally {
            setUploading(false);
        }
    }

    function onDriveMenuSelect() {
        if (isGoogleDrivePickerConfigured()) {
            void importFromDrivePicker();
            return;
        }
        setLinkOpen("drive");
        setLinkValue("");
        setLinkError(null);
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.csv,text/csv"
                multiple
                className="hidden"
                onChange={handleUpload}
            />
            <DropdownMenu onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className={`flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm transition-colors cursor-pointer ${
                            count > 0
                                ? "text-blue-600 hover:bg-blue-50"
                                : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        } ${isOpen ? "bg-gray-100" : ""}`}
                        title="Add documents"
                        aria-label="Add documents"
                    >
                        <PlusIcon
                            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-[135deg]" : ""}`}
                        />
                        <span className="hidden sm:inline">Documents</span>
                        {count > 0 && (
                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium tabular-nums text-white">
                                {count}
                            </span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    className="w-52 z-50"
                    side="bottom"
                    align="start"
                >
                    <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={uploading}
                        onSelect={(e) => {
                            e.preventDefault();
                            fileInputRef.current?.click();
                        }}
                    >
                        {uploading ? (
                            <Loader2Icon className="h-4 w-4 mr-2 animate-spin text-gray-400" />
                        ) : (
                            <Upload className="h-4 w-4 mr-2 text-gray-500" />
                        )}
                        <span className="text-sm">
                            {uploading ? "Uploading…" : "Upload files"}
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={uploading}
                        onSelect={(e) => {
                            e.preventDefault();
                            onDriveMenuSelect();
                        }}
                    >
                        <GoogleDriveIcon className="h-4 w-4 mr-2" />
                        <span className="text-sm">Google Drive</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        disabled={uploading}
                        onSelect={(e) => {
                            e.preventDefault();
                            setLinkOpen("url");
                            setLinkValue("");
                            setLinkError(null);
                        }}
                    >
                        <Link2 className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-sm">From URL</span>
                    </DropdownMenuItem>
                    {!startupId && (
                        <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={onBrowseAll}
                        >
                            <LayoutGridIcon className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="text-sm">Browse all</span>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {linkOpen && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/20 p-4 sm:items-center">
                    <div
                        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
                        role="dialog"
                        aria-label={
                            linkOpen === "drive"
                                ? "Import from Google Drive"
                                : "Import from URL"
                        }
                    >
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                            {linkOpen === "drive" ? (
                                <>
                                    <GoogleDriveIcon className="h-4 w-4" />
                                    Google Drive link
                                </>
                            ) : (
                                <>
                                    <Link2 className="h-4 w-4 text-slate-400" />
                                    Document URL
                                </>
                            )}
                        </div>
                        <input
                            type="url"
                            autoFocus
                            value={linkValue}
                            onChange={(e) => setLinkValue(e.target.value)}
                            placeholder={
                                linkOpen === "drive"
                                    ? "Paste Drive share link (Anyone with the link)"
                                    : "https://… PDF, DOCX, TXT"
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void importFromLink();
                                }
                            }}
                        />
                        {linkOpen === "drive" && (
                            <p className="mt-1.5 text-xs text-slate-500">
                                Share as Viewer → Anyone with the link, then
                                paste here.
                            </p>
                        )}
                        {linkError && (
                            <p className="mt-1.5 text-xs text-red-600">
                                {linkError}
                            </p>
                        )}
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                                onClick={() => {
                                    setLinkOpen(null);
                                    setLinkError(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={uploading || !linkValue.trim()}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                                onClick={() => void importFromLink()}
                            >
                                {uploading && (
                                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                                )}
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
