"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Building2, Network } from "lucide-react";
import { HeaderSearchBtn } from "@/app/components/shared/HeaderSearchBtn";
import { RowActions } from "@/app/components/shared/RowActions";
import {
  listStartups,
  deleteStartup,
  type StartupRecord,
} from "@/lib/startupsApi";
import { CreatePlantModal } from "@/app/components/engram/CreatePlantModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function graphLabel(plant: StartupRecord): {
  text: string;
  className: string;
} {
  const n = plant.knowledgeGraph?.nodes?.length ?? 0;
  const critical =
    plant.riskReport?.atRiskAssets?.filter(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        (a as { riskLevel?: string }).riskLevel === "critical",
    ).length ?? 0;

  if (n === 0) {
    return { text: "No graph yet", className: "text-slate-400" };
  }
  if (critical > 0) {
    return {
      text: `${n} nodes · ${critical} critical`,
      className: "text-red-600",
    };
  }
  return { text: `${n} nodes`, className: "text-slate-600" };
}

export function StartupsPage() {
  const [plants, setPlants] = useState<StartupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  function refreshList() {
    setFetchError(null);
    listStartups()
      .then(setPlants)
      .catch(() => setFetchError("Failed to refresh plants. Please try again."));
  }

  useEffect(() => {
    let cancelled = false;
    listStartups()
      .then((list) => {
        if (!cancelled) setPlants(list);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError("Failed to load plants. Check your connection and refresh.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string) {
    await deleteStartup(id).catch(() => {});
    setPlants((prev) => prev.filter((s) => s.id !== id));
  }

  const q = search.toLowerCase();
  const filtered = useMemo(
    () => plants.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [plants, q],
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="mb-1 flex items-center justify-between px-4 py-3 md:px-10">
          <div>
            <h1 className="text-2xl font-medium font-serif text-gray-900">
              Plants
            </h1>
            {!loading && plants.length > 0 && (
              <p className="mt-0.5 text-xs text-gray-400">
                {plants.length} plant{plants.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <HeaderSearchBtn
              value={search}
              onChange={setSearch}
              placeholder="Search plants…"
            />
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-900 transition-colors"
              title="New plant"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-4 md:px-10 pb-10">
          {fetchError && (
            <p className="mb-4 text-sm text-red-600">{fetchError}</p>
          )}

          {loading ? (
            <div className="space-y-2 py-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <Building2 className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-800">
                {search ? "No matching plants" : "No plants yet"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Create a plant site, then load the Unit 3 demo or ingest maintenance
                documents to build the knowledge graph.
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  New plant
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="hidden sm:grid grid-cols-[1fr_160px_140px_48px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <span>Plant</span>
                <span>Knowledge graph</span>
                <span>Created</span>
                <span />
              </div>
              {filtered.map((plant) => {
                const status = graphLabel(plant);
                return (
                  <div
                    key={plant.id}
                    className="group grid cursor-pointer grid-cols-1 sm:grid-cols-[1fr_160px_140px_48px] gap-1 sm:gap-2 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
                    onClick={() => router.push(`/startups/${plant.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Network className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {plant.name}
                      </span>
                    </div>
                    <div className={`flex items-center text-xs ${status.className}`}>
                      {status.text}
                    </div>
                    <div className="flex items-center text-xs text-slate-400">
                      {formatDate(plant.createdAt)}
                    </div>
                    <div
                      className="flex items-center justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowActions
                        onDelete={() => void handleDelete(plant.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CreatePlantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={refreshList}
      />
    </>
  );
}
