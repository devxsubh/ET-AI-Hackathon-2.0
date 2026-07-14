import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { TOKEN_TYPES } from "../../lib/auth/config";

const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [TOKEN_TYPES.REFRESH],
      required: true,
    },
    blacklisted: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

schema.index({ tokenHash: 1, type: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthToken =
  mongoose.models["AuthToken"] ?? mongoose.model("AuthToken", schema);

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRefreshTokenValue(): string {
  return crypto.randomBytes(33).toString("hex");
}

export async function saveRefreshToken(
  userId: Types.ObjectId,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await AuthToken.create({
    userId,
    tokenHash: hashRefreshToken(token),
    type: TOKEN_TYPES.REFRESH,
    expiresAt,
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const doc = await AuthToken.findOne({
    tokenHash: hashRefreshToken(token),
    type: TOKEN_TYPES.REFRESH,
    blacklisted: false,
  });
  if (!doc) throw new Error("Refresh token not found");
  await doc.deleteOne();
}

export async function findValidRefreshToken(token: string) {
  const doc = await AuthToken.findOne({
    tokenHash: hashRefreshToken(token),
    type: TOKEN_TYPES.REFRESH,
    blacklisted: false,
  });
  if (!doc) return null;
  if (doc.expiresAt.getTime() < Date.now()) return null;
  return doc;
}
