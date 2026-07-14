import mongoose from "mongoose";
import {
  AssistantChat,
  HiddenSampleAsset,
  Startup,
  type SampleAssetType,
} from "../../models";

/** System owner for global sample workspaces — not a real login user. */
export const SAMPLE_SYSTEM_USER_ID = "sample";

export async function getHiddenSampleIds(
  userId: string,
  assetType: SampleAssetType,
): Promise<Set<string>> {
  const rows = await HiddenSampleAsset.find({ userId, assetType })
    .select("assetId")
    .lean();
  return new Set(rows.map((r) => r.assetId as string));
}

export async function hideSampleAsset(
  userId: string,
  assetType: SampleAssetType,
  assetId: string,
): Promise<void> {
  await HiddenSampleAsset.updateOne(
    { userId, assetType, assetId },
    { $set: { hiddenAt: new Date() } },
    { upsert: true },
  );
}

export function excludeHiddenIds(
  hidden: Set<string>,
): Record<string, unknown> | null {
  if (hidden.size === 0) return null;
  return {
    _id: {
      $nin: [...hidden].map((id) =>
        mongoose.Types.ObjectId.isValid(id)
          ? new mongoose.Types.ObjectId(id)
          : id,
      ),
    },
  };
}

/** Startups owned by the user OR marked global sample (minus per-user hides). */
export async function visibleStartupFilter(
  userId: string,
): Promise<Record<string, unknown>> {
  const hidden = await getHiddenSampleIds(userId, "startup");
  const notHidden = excludeHiddenIds(hidden);
  const base: Record<string, unknown> = {
    $or: [{ ownerId: userId }, { isSample: true }],
  };
  if (!notHidden) return base;
  return { $and: [base, notHidden] };
}

export async function findAccessibleStartup(
  id: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const hidden = await getHiddenSampleIds(userId, "startup");
  if (hidden.has(id)) return null;
  return Startup.findOne({
    _id: id,
    $or: [{ ownerId: userId }, { isSample: true }],
  }).lean() as Promise<Record<string, unknown> | null>;
}

export function isSampleRecord(
  row: Record<string, unknown> | null | undefined,
): boolean {
  return row?.isSample === true;
}

export function isWritableStartup(
  row: Record<string, unknown>,
  userId: string,
): boolean {
  if (isSampleRecord(row)) return false;
  return row.ownerId === userId;
}

export async function visibleAssistantChatFilter(
  userId: string,
): Promise<Record<string, unknown>> {
  return { userId };
}

export async function findAccessibleAssistantChat(
  id: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return AssistantChat.findOne({
    _id: id,
    userId,
  }).lean() as Promise<Record<string, unknown> | null>;
}

export function isWritableChat(
  row: Record<string, unknown>,
  userId: string,
): boolean {
  return row.userId === userId;
}
