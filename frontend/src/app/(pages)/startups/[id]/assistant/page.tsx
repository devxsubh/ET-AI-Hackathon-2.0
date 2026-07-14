"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy project-assistant routes redirect into the Engram plant workspace. */
export default function PlantAssistantRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/startups/${id}`);
  }, [id, router]);
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Redirecting to plant workspace…
    </div>
  );
}
