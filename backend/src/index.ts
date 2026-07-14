import "./loadEnv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { logAuthStartupWarnings } from "./lib/auth/config";
import { logEncryptionSecretWarnings } from "./lib/auth/encryptionSecret";
import { logEmailStartupWarnings } from "./lib/auth/emailConfig";
import { logR2StartupWarnings } from "./lib/infra/r2Config";
import { logRagStartupWarnings } from "./lib/rag/embed";
import { logWebSearchStartupWarnings } from "./lib/infra/webSearchConfig";
import {
  projectDocumentsRouter,
  singleDocumentsRouter,
} from "./routes/documents/singleDocuments";
import { projectsRouter } from "./routes/projects/index";
import { chatRouter } from "./routes/chat";
import { assistantChatRouter } from "./routes/assistantChat";
import { startupsRouter } from "./routes/startups/index";
import { auditLogsRouter } from "./routes/auditLogs";
import { chatsRouter } from "./routes/chats";
import { configRouter } from "./routes/config";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/user";
import { getAnthropicModel } from "./lib/llm/models";
import { validateAnthropicKeyLive } from "./lib/llm/validateKey";
import { disconnectDb } from "./lib/infra/db";
import { startupDocumentDownloadRouter } from "./routes/documents/startupDocumentDownload";
import { requireAuth } from "./middleware/requireAuth";
import {
  assistantChatLimiter,
  screenerChatLimiter,
} from "./lib/infra/chatRateLimits";
import { isCacheRedis } from "./lib/infra/cache";

const app = express();
const PORT = process.env.PORT ?? 3001;
const isProduction = process.env.NODE_ENV === "production";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function minutes(value: number): number {
  return value * 60 * 1000;
}

const generalLimiter = rateLimit({
  windowMs: minutes(envInt("RATE_LIMIT_GENERAL_WINDOW_MINUTES", 15)),
  max: envInt("RATE_LIMIT_GENERAL_MAX", 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: { detail: "Too many requests. Please try again later." },
});

app.disable("x-powered-by");
app.set("trust proxy", envInt("TRUST_PROXY_HOPS", 1));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: "no-referrer" },
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.use(generalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

app.use("/api/chat", requireAuth, screenerChatLimiter, chatRouter);
app.use("/chat", requireAuth, assistantChatLimiter, assistantChatRouter);

app.use("/single-documents", singleDocumentsRouter);
app.use("/projects", projectsRouter);
app.use("/projects", projectDocumentsRouter);

app.use("/api/startups", startupsRouter);
app.use("/api/documents", startupDocumentDownloadRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/config", configRouter);
app.use("/auth", authRouter);
app.use("/user", userRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((_req, res) => {
  res.status(404).json({ detail: "Not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;

  const rawStatus = (err as Record<string, unknown>)?.status ?? (err as Record<string, unknown>)?.statusCode;
  const status: number =
    typeof rawStatus === "number" && rawStatus >= 400 && rawStatus < 600
      ? rawStatus
      : err instanceof SyntaxError
        ? 400
        : 500;

  if (status >= 500) {
    console.error(err);
  }

  const message =
    isProduction && status >= 500
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "An error occurred";

  res.status(status).json({ detail: message });
});

const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  logAuthStartupWarnings();
  logEncryptionSecretWarnings();
  logEmailStartupWarnings();
  logR2StartupWarnings();
  logRagStartupWarnings();
  logWebSearchStartupWarnings();
  console.log(`Anthropic model: ${getAnthropicModel()}`);
  console.log(`Cache backend: ${isCacheRedis() ? "Upstash Redis" : "in-memory (no UPSTASH_REDIS_REST_URL set)"}`);
  void validateAnthropicKeyLive();
});

function shutdown(signal: string): void {
  console.log(`${signal} received — starting graceful shutdown`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(() => {
    disconnectDb()
      .then(() => {
        clearTimeout(forceExit);
        process.exit(0);
      })
      .catch((err) => {
        console.error("Error closing MongoDB connection:", err);
        process.exit(1);
      });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
