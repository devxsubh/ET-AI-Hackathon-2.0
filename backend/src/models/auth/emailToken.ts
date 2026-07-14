import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import {
  EMAIL_TOKEN_TYPES,
  type EmailTokenType,
  PASSWORD_RESET_EXPIRY_HOURS,
  VERIFY_EMAIL_EXPIRY_HOURS,
} from "../../lib/auth/emailConfig";

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
      enum: Object.values(EMAIL_TOKEN_TYPES),
      required: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

schema.index({ tokenHash: 1, type: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailToken =
  mongoose.models["EmailToken"] ?? mongoose.model("EmailToken", schema);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateTokenValue(): string {
  return crypto.randomBytes(32).toString("hex");
}

function expiryForType(type: EmailTokenType): Date {
  const hours =
    type === EMAIL_TOKEN_TYPES.VERIFY_EMAIL
      ? VERIFY_EMAIL_EXPIRY_HOURS
      : PASSWORD_RESET_EXPIRY_HOURS;
  const expires = new Date();
  expires.setHours(expires.getHours() + hours);
  return expires;
}

export async function issueEmailToken(
  userId: Types.ObjectId,
  type: EmailTokenType,
): Promise<string> {
  await EmailToken.deleteMany({ userId, type });
  const token = generateTokenValue();
  await EmailToken.create({
    userId,
    tokenHash: hashToken(token),
    type,
    expiresAt: expiryForType(type),
  });
  return token;
}

export async function consumeEmailToken(
  token: string,
  type: EmailTokenType,
): Promise<Types.ObjectId | null> {
  const doc = await EmailToken.findOne({
    tokenHash: hashToken(token),
    type,
  });
  if (!doc) return null;
  if (doc.expiresAt.getTime() < Date.now()) {
    await doc.deleteOne();
    return null;
  }
  const userId = doc.userId as Types.ObjectId;
  await EmailToken.deleteMany({ userId, type });
  return userId;
}
