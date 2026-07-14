"use client";

import { use } from "react";
import { PlantWorkspacePage } from "@/app/components/engram/PlantWorkspacePage";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PlantDetailPage({ params }: Props) {
  const { id } = use(params);
  return <PlantWorkspacePage startupId={id} />;
}
