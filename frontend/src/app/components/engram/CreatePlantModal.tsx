"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { createStartup } from "@/lib/startupsApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreatePlantModal({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const next = name.trim() || "New plant site";
    setLoading(true);
    setError(null);
    try {
      const plant = await createStartup(next);
      onCreated?.();
      onClose();
      router.push(`/startups/${plant.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">New plant</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={(e) => void handleCreate(e)} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Site / unit name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bharat Engineering Works — Unit 3"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            After creating, load the Unit 3 demo or ingest maintenance documents
            to build the knowledge graph.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create plant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
