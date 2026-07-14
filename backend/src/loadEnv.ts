import { config } from "dotenv";
import path from "path";

const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");

/** Monorepo root `.env` — single source of truth for local dev. */
config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(repoRoot, ".env.local"), override: true });

/** Optional per-package overrides (legacy); prefer editing root `.env`. */
config({ path: path.join(backendRoot, ".env"), override: true });
config({ path: path.join(backendRoot, ".env.local"), override: true });
