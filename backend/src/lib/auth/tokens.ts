import {
  JWT_ACCESS_TOKEN_EXPIRATION_MINUTES,
  REFRESH_TOKEN_EXPIRATION_DAYS,
} from "./config";
import { signAccessToken } from "./jwt";
import {
  generateRefreshTokenValue,
  saveRefreshToken,
} from "../../models";
import type { UserDocument } from "../../models";

export interface AuthTokens {
  accessToken: { token: string; expires: string };
  refreshToken: { expires: string };
}

export async function generateAuthTokens(
  user: UserDocument,
): Promise<AuthTokens & { refreshTokenValue: string; refreshExpires: Date }> {
  const accessExpires = new Date(
    Date.now() + JWT_ACCESS_TOKEN_EXPIRATION_MINUTES * 60 * 1000,
  );
  const refreshExpires = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
  );

  const accessToken = signAccessToken(
    user._id.toString(),
    user.email,
    accessExpires,
  );
  const refreshTokenValue = generateRefreshTokenValue();
  await saveRefreshToken(user._id, refreshTokenValue, refreshExpires);

  return {
    accessToken: {
      token: accessToken,
      expires: accessExpires.toISOString(),
    },
    refreshToken: {
      expires: refreshExpires.toISOString(),
    },
    refreshTokenValue,
    refreshExpires,
  };
}

export function serializeAuthTokens(
  tokens: AuthTokens,
): { accessToken: AuthTokens["accessToken"]; refreshToken: AuthTokens["refreshToken"] } {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}
