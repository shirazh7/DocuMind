// ── PLATFORM CAPABILITIES PAGE ─────────────────────────────────────────
//
// Makes invisible backend features visible for demos and code reviews.
// Everything displayed here is read live at request time — nothing is
// hardcoded or mocked. Sections cover:
//
//   Feature Flags    — live values from the Vercel Flags SDK
//   Service Wiring   — env var presence for each Vercel integration
//   Data & Retrieval — real row counts from Neon (RAG chunks, uploads,
//                      chat sessions)
//   Workflow Automation — cron schedules from vercel.ts, WAF rule status
//
// The "Refresh" action re-runs the server component. It is rate-limited
// via lib/rate-limit/demo.ts (30 req/min) to prevent the Neon/Redis
// queries from being hammered by automated clients.

import { EMBEDDING_MODEL } from "@/lib/rag/embeddings";
import { premiumModelEnabled, evalSuiteEnabled } from "@/flags";
import { getCurrentUserId } from "@/lib/auth/user-id";
import { ensureDatabaseSchema } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { enforceDemoRefreshRateLimit } from "@/lib/rate-limit/demo";
import { MODELS, DEFAULT_MODEL_ID } from "@/lib/ai/models";
import { config as vercelTsConfig } from "../../../../vercel";

export const runtime = "nodejs";

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        ok
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-red-500/10 text-red-600"
      }`}
    >
      {ok ? "Active" : "Missing"}
    </span>
  );
}

interface VercelCron {
  path?: string;
  schedule?: string;
}

interface VercelRouteRule {
  src?: string;
  missing?: { type?: string; key?: string }[];
  mitigate?: { action?: string };
}

interface VercelConfigFile {
  crons?: VercelCron[];
  routes?: VercelRouteRule[];
}

export default async function DemoPage() {
  const userId = await getCurrentUserId();
  const demoLimit = await enforceDemoRefreshRateLimit(userId);

  if (!demoLimit.success) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-12">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h1 className="text-lg font-semibold tracking-tight">
              Platform Capabilities temporarily rate limited
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Too many refreshes in a short window. Please wait a moment and try
              again. This protects backend resources during demos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [isPremiumFlagOn, isEvalFlagOn] = await Promise.all([
    premiumModelEnabled(),
    evalSuiteEnabled(),
  ]);

  const envChecks = {
    aiGateway: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    neon: Boolean(process.env.DATABASE_URL),
    redis: Boolean(
      process.env.KV_REST_API_URL ||
        process.env.UPSTASH_REDIS_REST_URL
    ),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    flags: Boolean(process.env.FLAGS),
  };

  // Read cron and route configuration directly from vercel.ts (the source of
  // truth after migrating from vercel.json). The config object is statically
  // imported so this always reflects the deployed configuration.
  const vercelConfig = vercelTsConfig as unknown as VercelConfigFile;

  const cronRules =
    vercelConfig?.crons?.filter((cron) => cron.path && cron.schedule) ?? [];
  const hasWorkflowWafRule =
    vercelConfig?.routes?.some(
      (rule) =>
        rule.src === "/api/workflows/(.*)" &&
        rule.missing?.some(
          (header) =>
            header.type === "header" && header.key?.toLowerCase() === "x-vercel-cron"
        ) &&
        rule.mitigate?.action === "deny"
    ) ?? false;

  await ensureDatabaseSchema();
  const sql = getDb();

  const [ragTotalRow] = (await sql`
    SELECT COUNT(*)::text AS count
    FROM rag_chunks
    WHERE embedding_model = ${EMBEDDING_MODEL}
  `) as { count: string }[];

  const [ragUploadRow] = (await sql`
    SELECT COUNT(*)::text AS count
    FROM rag_chunks
    WHERE embedding_model = ${EMBEDDING_MODEL}
      AND source LIKE 'user-doc:%'
  `) as { count: string }[];

  const [docSummaryRow] = (await sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'ready')::text AS ready,
      COUNT(*) FILTER (WHERE status = 'processing')::text AS processing,
      COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
    FROM user_documents
    WHERE user_id = ${userId}
  `) as {
    total: string;
    ready: string;
    processing: string;
    failed: string;
  }[];

  const [chatSummaryRow] = (await sql`
    SELECT
      COUNT(*)::text AS sessions,
      (
        SELECT COUNT(*)::text
        FROM chat_messages m
        INNER JOIN chat_sessions s ON s.id = m.session_id
        WHERE s.user_id = ${userId}
      ) AS messages
    FROM chat_sessions
    WHERE user_id = ${userId}
  `) as { sessions: string; messages: string }[];

  const ragTotal = Number(ragTotalRow?.count ?? "0");
  const ragUploads = Number(ragUploadRow?.count ?? "0");

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight mb-1">
                Platform Capabilities
              </h1>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Live operational proof for capabilities that are usually invisible in
                the UI: feature flags, storage wiring, workflow scheduling, and RAG
                readiness.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Last checked: {new Date().toISOString()}
              </p>
            </div>
            <form action="/demo">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15.55-6.36L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15.55 6.36L3 16" />
                </svg>
                Refresh
              </button>
            </form>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Feature Flags (Live)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="font-mono text-xs text-muted-foreground">
                premium-model-enabled
              </p>
              <p className="mt-1 font-medium">{yesNo(isPremiumFlagOn)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Unlocks Claude Sonnet 4.5 (with reasoning trace) in the chat model selector.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-mono text-xs text-muted-foreground">
                eval-suite-enabled
              </p>
              <p className="mt-1 font-medium">{yesNo(isEvalFlagOn)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Controls whether the Evaluation Suite page is usable.
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">Model access resolved from flags</p>
            <p className="mt-1">
              Available models:{" "}
              <span className="font-medium">
                {isPremiumFlagOn
                  ? Object.values(MODELS).map((m) => m.name).join(", ")
                  : MODELS[DEFAULT_MODEL_ID]?.name ?? DEFAULT_MODEL_ID}
              </span>
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Service Wiring</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3 flex items-center justify-between">
              <span>AI Gateway configured</span>
              <StatusPill ok={envChecks.aiGateway} />
            </div>
            <div className="rounded-lg border border-border p-3 flex items-center justify-between">
              <span>Neon configured</span>
              <StatusPill ok={envChecks.neon} />
            </div>
            <div className="rounded-lg border border-border p-3 flex items-center justify-between">
              <span>Upstash configured</span>
              <StatusPill ok={envChecks.redis} />
            </div>
            <div className="rounded-lg border border-border p-3 flex items-center justify-between">
              <span>Blob configured</span>
              <StatusPill ok={envChecks.blob} />
            </div>
            <div className="rounded-lg border border-border p-3 flex items-center justify-between">
              <span>Flags env provisioned</span>
              <StatusPill ok={envChecks.flags} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Data + Retrieval Readiness</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">RAG chunks (total)</p>
              <p className="text-xl font-semibold mt-1">{ragTotal}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">RAG chunks (uploads)</p>
              <p className="text-xl font-semibold mt-1">{ragUploads}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Uploaded documents</p>
              <p className="text-xl font-semibold mt-1">
                {Number(docSummaryRow?.total ?? "0")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Indexed ready docs</p>
              <p className="text-xl font-semibold mt-1">
                {Number(docSummaryRow?.ready ?? "0")}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Upload indexing status</p>
              <p className="mt-1">
                processing: <span className="font-medium">{Number(docSummaryRow?.processing ?? "0")}</span>{" "}
                / failed: <span className="font-medium">{Number(docSummaryRow?.failed ?? "0")}</span>
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Chat persistence</p>
              <p className="mt-1">
                sessions: <span className="font-medium">{Number(chatSummaryRow?.sessions ?? "0")}</span>{" "}
                / messages: <span className="font-medium">{Number(chatSummaryRow?.messages ?? "0")}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Workflow Automation</h2>
          {cronRules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {cronRules.map((cron) => (
                <div key={`${cron.path}-${cron.schedule}`} className="rounded-lg border border-border p-3">
                  <p className="font-mono text-xs text-muted-foreground">{cron.path}</p>
                  <p className="mt-1">
                    Cron schedule: <span className="font-medium">{cron.schedule}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No cron rules found in vercel.ts.</p>
          )}
          <div className="mt-3 rounded-lg border border-border p-3 flex items-center justify-between text-sm">
            <span>Workflow WAF rule (requires x-vercel-cron)</span>
            <StatusPill ok={hasWorkflowWafRule} />
          </div>
        </section>
      </div>
    </div>
  );
}

