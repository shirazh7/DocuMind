"use client";

import { useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

// ── Detail data for each node ────────────────────────────────────────

interface NodeDetail {
  file: string;
  description: string;
  sdkImports?: string[];
  sdkUsage?: { fn: string; purpose: string }[];
  keyCode?: string;
}

const NODE_DETAILS: Record<string, NodeDetail> = {
  "chat-ui": {
    file: "src/components/chat/chat-interface.tsx",
    description: "Main chat interface using the AI SDK's useChat hook with DefaultChatTransport for streaming communication with the API route.",
    sdkImports: [
      "useChat from @ai-sdk/react",
      "DefaultChatTransport from ai",
    ],
    sdkUsage: [
      { fn: "useChat()", purpose: "Manages chat state, message history, streaming status, and the stop() function" },
      { fn: "DefaultChatTransport", purpose: "Configured with { api: \"/api/chat\" } for streaming Route Handler communication" },
      { fn: "sendMessage()", purpose: "Sends { text } with { body: { modelId, sessionId } } for persisted chats" },
      { fn: "message.parts", purpose: "Iterates part.type === \"tool-retrieveDocuments\" to extract grounded sources" },
      { fn: "status", purpose: "Checks \"streaming\" | \"submitted\" | \"error\" for user-visible runtime states" },
    ],
    keyCode: `const { messages, sendMessage, status, stop } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
  }),
});`,
  },
  "kb": {
    file: "src/components/kb/kb-search.tsx",
    description: "Browse and search the 5 internal engineering documents. Links to /kb/[slug] for viewing and /chat?q=... for asking questions.",
    sdkImports: [],
    sdkUsage: [],
  },
  "eval-suite": {
    file: "src/components/eval/eval-runner.tsx",
    description: "Runs 19 test cases sequentially against /api/eval, with 500ms delay between requests to avoid rate limiting. Checks grounding via substring matching of expected facts. Gated behind the eval-suite-enabled Vercel Flag to prevent accidental production runs.",
    sdkImports: [],
    sdkUsage: [
      { fn: "POST /api/eval", purpose: "Calls generateText on the server; client receives { answer, sources, latency }" },
      { fn: "checkGrounding()", purpose: "Case-insensitive substring match — pass if ≥60% of expectedFacts found" },
    ],
  },
  "api-chat": {
    file: "src/app/api/chat/route.ts",
    description: "Main chat route. Enforces Upstash rate limiting before the LLM call, persists messages to Neon on stream completion, and streams cost metadata back to the client. Abort signal propagation cancels the Gateway call if the client disconnects.",
    sdkImports: [
      "streamText from ai",
      "convertToModelMessages from ai",
      "stepCountIs from ai",
      "smoothStream from ai",
      "consumeStream from ai",
    ],
    sdkUsage: [
      { fn: "enforceChatRateLimit()", purpose: "Upstash sliding window check — returns 429 with X-RateLimit-* headers if exceeded" },
      { fn: "streamText()", purpose: "Streams LLM response with { model, system, messages, tools, stopWhen: stepCountIs(5) }" },
      { fn: "smoothStream({ delayInMs: 20 })", purpose: "Buffers raw token chunks and re-emits word-by-word — prevents choppy UI updates from large Claude batches" },
      { fn: "convertToModelMessages()", purpose: "Converts UIMessage[] from the client into the model's message format" },
      { fn: "stepCountIs(5)", purpose: "5 steps: retrieve → refine+retrieve → answer → follow-ups. Claude reasoning needs the extra headroom" },
      { fn: "toUIMessageStreamResponse({ sendReasoning: true })", purpose: "Forwards reasoning tokens (Claude Sonnet 4.5) as part.type === 'reasoning' parts for the Thought block" },
      { fn: "messageMetadata", purpose: "Sends { modelId, sessionId } on 'start' and { totalUsage, estimatedCost, durationMs } on 'finish'" },
      { fn: "onFinish → replaceChatMessages()", purpose: "Persists the complete message array to Neon chat_messages after stream completes" },
    ],
    keyCode: `await enforceChatRateLimit(userId); // Upstash 429 guard

const result = streamText({
  model: validModelId,   // "openai/gpt-4.1-nano" via Gateway
  messages: await convertToModelMessages(messages),
  tools: documentTools,
  stopWhen: stepCountIs(5),
  experimental_transform: smoothStream({ delayInMs: 20 }),
  abortSignal: req.signal, // cancel Gateway if client leaves
});

return result.toUIMessageStreamResponse({
  sendReasoning: true,     // Claude Sonnet 4.5 Thought block
  onFinish: ({ messages }) => replaceChatMessages(sessionId, messages),
});`,
  },
  "api-eval": {
    file: "src/app/api/eval/route.ts",
    description: "Evaluation API route. Uses generateText (blocking, not streaming) so the full response can be checked for grounding before returning.",
    sdkImports: [
      "generateText from ai",
      "stepCountIs from ai",
    ],
    sdkUsage: [
      { fn: "generateText()", purpose: "Blocking LLM call with { model, system, prompt, tools, stopWhen }" },
      { fn: "steps + toolResults", purpose: "Iterates step.toolResults to extract retrieved sources from the tool calls" },
    ],
    keyCode: `const { text, steps } = await generateText({
  model: validModelId,
  system: SYSTEM_PROMPT,
  prompt: question,
  tools: documentTools,
  stopWhen: stepCountIs(3),
});`,
  },
  "retrieve-tool": {
    file: "src/lib/ai/tools.ts",
    description: "The retrieveDocuments tool definition using the AI SDK's tool() wrapper with a Zod input schema. The LLM calls this tool to search the knowledge base.",
    sdkImports: [
      "tool from ai",
    ],
    sdkUsage: [
      { fn: "tool()", purpose: "Wraps the tool definition with { description, inputSchema, execute }" },
      { fn: "inputSchema", purpose: "z.object({ query: z.string() }) for typed, validated retrieval input" },
      { fn: "execute()", purpose: "Calls retrieveRelevantChunks(query, 5), returns { results, avgSimilarity }" },
    ],
    keyCode: `export const documentTools = {
  retrieveDocuments: tool({
    description: "Search the internal knowledge base...",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
    }),
    execute: async ({ query }) => {
      const chunks = await retrieveRelevantChunks(query, 5);
      return { results: chunks.map(...), avgSimilarity };
    },
  }),
};`,
  },
  "system-prompt": {
    file: "src/lib/ai/system-prompt.ts",
    description: "System prompt with 6 rules: only use retrieved docs, cite with [1]/[2], decline when unsure, use markdown, redirect off-topic, always call retrieveDocuments first.",
    sdkImports: [],
    sdkUsage: [],
    keyCode: `RULES:
1. ONLY answer using retrieved documents
2. Cite sources using [1], [2] notation
3. Decline: "I don't have enough information..."
4. Be concise, use markdown
5. Redirect off-topic questions
6. Always call retrieveDocuments before answering`,
  },
  "model-config": {
    file: "src/lib/ai/models.ts",
    description: "Three models via Vercel AI Gateway plain string IDs — no provider SDK imports. Claude Sonnet 4.5 is gated behind the premium-model-enabled Vercel Flag and supports extended thinking (reasoning tokens). Cost-per-token is hardcoded for estimatedCost calculation streamed to the client.",
    sdkImports: [],
    sdkUsage: [
      { fn: "Plain string model IDs", purpose: "\"openai/gpt-4.1-nano\", \"openai/gpt-4o-mini\", \"anthropic/claude-sonnet-4-5\" — gateway routes automatically" },
      { fn: "supportsThinking: true", purpose: "Signals the API route to inject providerOptions.anthropic.thinking for Claude's extended thinking mode" },
      { fn: "getModelCost()", purpose: "Returns { inputPerToken, outputPerToken } for estimatedCost calculation streamed per message" },
    ],
    keyCode: `"openai/gpt-4.1-nano": {       // default, cheapest
  inputPerToken:  0.1  / 1_000_000,
  outputPerToken: 0.4  / 1_000_000,
}
"openai/gpt-4o-mini": {        // flag-gated
  inputPerToken:  0.15 / 1_000_000,
  outputPerToken: 0.6  / 1_000_000,
}
"anthropic/claude-sonnet-4-5": { // flag-gated, reasoning
  inputPerToken:  3    / 1_000_000,
  outputPerToken: 15   / 1_000_000,
  supportsThinking: true,
}`,
  },
  "chunker": {
    file: "src/lib/rag/chunker.ts",
    description: "Splits markdown documents into chunks by heading sections (#{1,3}). Uses overlapping windows with paragraph-then-sentence boundary preference.",
    sdkImports: [],
    sdkUsage: [],
    keyCode: `TARGET_CHUNK_TOKENS = 500  // ~2000 chars
OVERLAP_TOKENS = 50       // ~200 chars
// Splits at paragraph > sentence boundaries
// Metadata: { title, section, source, chunkIndex }`,
  },
  "embeddings": {
    file: "src/lib/rag/embeddings.ts",
    description: "Generates embeddings using the AI SDK's embed() and embedMany() functions through the Vercel AI Gateway.",
    sdkImports: [
      "embed from ai",
      "embedMany from ai",
    ],
    sdkUsage: [
      { fn: "embedMany()", purpose: "Batch-embeds document chunks (batch size 100) using \"openai/text-embedding-3-small\"" },
      { fn: "embed()", purpose: "Embeds a single user query for cosine similarity search" },
    ],
    keyCode: `const EMBEDDING_MODEL = "openai/text-embedding-3-small";

// Batch embed chunks
const { embeddings } = await embedMany({
  model: EMBEDDING_MODEL,
  values: batch,
});

// Embed single query
const { embedding } = await embed({
  model: EMBEDDING_MODEL,
  value: query,
});`,
  },
  "vector-store": {
    file: "src/lib/rag/store.ts",
    description: "Persistent Neon pgvector store. On first index it loads docs → chunks → embeds → upserts; retrieval then runs in SQL with cosine distance.",
    sdkImports: [],
    sdkUsage: [],
    keyCode: `await sql\`
  SELECT content, 1 - (embedding <=> $1::vector) AS similarity
  FROM rag_chunks
  ORDER BY embedding <=> $1::vector
  LIMIT 5
\`;`,
  },
  "markdown-docs": {
    file: "src/data/docs/*.md",
    description: "5 realistic engineering documents (~600-1000 words each) ingested into Neon pgvector via the rag-ingest workflow. Covers deployment, incidents, API auth, onboarding, and database migrations.",
    sdkImports: [],
    sdkUsage: [],
  },
  "ai-gateway": {
    file: "Vercel AI Gateway (external)",
    description: "Model references are plain strings like \"openai/gpt-4.1-nano\". The gateway handles provider routing, request tagging, and usage observability with no provider SDK lock-in.",
    sdkImports: [],
    sdkUsage: [
      { fn: "Gateway Auth", purpose: "Supports AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN for provider routing" },
    ],
  },
  "gpt-nano": {
    file: "via Vercel AI Gateway",
    description: "GPT-4.1 Nano — the default model. Cheapest option at $0.10/$0.40 per 1M tokens. Used for simple documentation lookups.",
    sdkImports: [],
    sdkUsage: [],
  },
  "gpt-mini": {
    file: "via Vercel AI Gateway",
    description: "GPT-4o Mini — higher accuracy option at $0.15/$0.60 per 1M tokens. Used when users want better synthesis quality.",
    sdkImports: [],
    sdkUsage: [],
  },
  "embed-model": {
    file: "via Vercel AI Gateway",
    description: "OpenAI text-embedding-3-small — 1536 dimensions. Cosine similarity scores typically range 0.25–0.65 (calibrated in confidence-badge.tsx).",
    sdkImports: [],
    sdkUsage: [
      { fn: "pgvector <=> operator", purpose: "Cosine similarity is computed in SQL by store.ts — ORDER BY embedding <=> query_vec LIMIT 5" },
    ],
  },
  "rate-limiter": {
    file: "src/lib/rate-limit/chat.ts",
    description: "Upstash Redis sliding window rate limiter protecting /api/chat. 20 requests/minute per user ID. Returns HTTP 429 with X-RateLimit-Limit and X-RateLimit-Remaining headers. Fails open (allows request) when Upstash credentials are absent — rate limiting is spend control, not a security gate.",
    sdkImports: ["@upstash/ratelimit", "@upstash/redis"],
    sdkUsage: [
      { fn: "Ratelimit.slidingWindow(20, '1 m')", purpose: "Sliding window prevents edge-burst that fixed windows allow (20 req at :59 + 20 req at :00)" },
      { fn: "limiter.limit(userId)", purpose: "Returns { success, limit, remaining, reset } — caller returns 429 when success is false" },
      { fn: "analytics: true", purpose: "Enables Upstash's request analytics dashboard at no extra cost" },
    ],
    keyCode: `const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "documind:chat",
});

const result = await ratelimit.limit(userId);
if (!result.success) return new Response(null, { status: 429 });`,
  },
  "chat-persistence": {
    file: "src/lib/chat/persistence.ts",
    description: "Neon Postgres persistence for chat sessions and messages. History survives page refreshes, cold starts, and redeploys. Replace-all write pattern: on each stream completion, DELETE existing rows + re-INSERT the full message array. ON DELETE CASCADE means deleting a session also removes all its messages.",
    sdkImports: [],
    sdkUsage: [
      { fn: "ensureChatSession()", purpose: "Upserts the session row before rate limiting — ensures it exists even if the request is later rejected" },
      { fn: "replaceChatMessages()", purpose: "Called in onFinish: deletes all messages for session, re-inserts full completed array with sort_order" },
      { fn: "listChatSessions()", purpose: "Returns last 20 sessions per user (title + updated_at) for the sidebar history list" },
      { fn: "pruneStaleChatSessions()", purpose: "Called by daily chatMaintenanceWorkflow — removes sessions + messages older than 30 days" },
    ],
    keyCode: `CREATE TABLE chat_sessions (id, user_id, title, updated_at);
CREATE TABLE chat_messages (
  id, session_id REFERENCES chat_sessions ON DELETE CASCADE,
  sort_order, role, parts JSONB, metadata JSONB,
  UNIQUE (session_id, sort_order)
);`,
  },
  "workflows": {
    file: "src/workflows/*.ts",
    description: "Four Vercel Workflows using 'use workflow' / 'use step' directives. Steps have automatic retry and durable checkpointing — a transient network failure restarts only the failed step. Cron triggers are scheduled in vercel.ts and protected: the /api/workflows/* route denies requests missing the x-vercel-cron header.",
    sdkImports: ["workflow package — 'use workflow' / 'use step' directives"],
    sdkUsage: [
      { fn: "ragIngestWorkflow", purpose: "Manual trigger: loads static docs → chunks → embeds via Gateway → upserts to Neon pgvector" },
      { fn: "ragReindexWorkflow", purpose: "Weekly cron (Sun 4am UTC): force-clears static chunks and re-embeds from scratch for freshness" },
      { fn: "chatMaintenanceWorkflow", purpose: "Daily cron (3am UTC): prunes Neon chat sessions + messages older than 30 days via CASCADE delete" },
      { fn: "docIngestWorkflow", purpose: "Per-upload trigger: chunks, embeds, and upserts a single user-uploaded document to pgvector" },
    ],
    keyCode: `export async function ragIngestWorkflow(force = false) {
  "use workflow";
  await runIngestionStep(force); // "use step" — auto-retry
}

// vercel.ts schedules crons + blocks external callers:
// mitigate: { action: "deny" } on /api/workflows/*
// unless x-vercel-cron header is present`,
  },
  "vercel-blob": {
    file: "src/app/api/documents/route.ts",
    description: "User-uploaded documents (PDF, DOCX, Markdown) are stored in Vercel Blob. Only raw file bytes go to Blob; operational metadata (filename, slug, status, user_id, extracted_text) is stored in Neon so it can be queried, indexed, and status-tracked.",
    sdkImports: ["@vercel/blob"],
    sdkUsage: [
      { fn: "put(filename, file, { access: 'public' })", purpose: "Stores the raw file bytes in Vercel Blob, returns a blob_url stored in Neon user_documents table" },
    ],
    keyCode: `const blob = await put(filename, file, {
  access: "public",
  contentType: file.type,
});
// blob.url stored in Neon user_documents
// docIngestWorkflow(documentId) triggered after upload`,
  },
  "flags": {
    file: "src/flags.ts",
    description: "Vercel Flags SDK controls model availability and eval page access. Evaluated server-side in page/layout components — clients only receive the resulting boolean, never the flag logic. Auto-reports every evaluation to Vercel Web Analytics for rollout observability.",
    sdkImports: ["flag from flags/next", "vercelAdapter from @flags-sdk/vercel"],
    sdkUsage: [
      { fn: "premiumModelEnabled", purpose: "OFF: only GPT-4.1 Nano. ON: GPT-4o Mini and Claude Sonnet 4.5 (with reasoning trace) appear in model selector" },
      { fn: "evalSuiteEnabled", purpose: "Gates the /eval page — prevents accidental production runs that burn AI Gateway credits" },
    ],
    keyCode: `export const premiumModelEnabled = flag<boolean>({
  key: "premium-model-enabled",
  adapter: vercelAdapter(), // reads Vercel Dashboard flag state
  defaultValue: false,      // safe default — no surprise spend
});`,
  },
  "claude-sonnet": {
    file: "via Vercel AI Gateway",
    description: "Claude Sonnet 4.5 — premium model at $3/$15 per 1M tokens. Supports Anthropic extended thinking: reasoning tokens stream to the client and render as a collapsible 'Thought' block in the UI (the v0 pattern). Gated behind the premium-model-enabled Vercel Flag.",
    sdkImports: [],
    sdkUsage: [
      { fn: "providerOptions.anthropic.thinking", purpose: "Enables extended thinking with budgetTokens: 8000 — caps reasoning cost per request" },
      { fn: "sendReasoning: true", purpose: "Forwards reasoning tokens to client as part.type === 'reasoning' parts for the Thought block UI" },
    ],
    keyCode: `// injected when model.supportsThinking === true
providerOptions: {
  anthropic: {
    thinking: { type: "enabled", budgetTokens: 8000 },
  },
}
// toUIMessageStreamResponse({ sendReasoning: true })
// → part.type === 'reasoning' → collapsible Thought block`,
  },
};

// ── Tiny reusable icons ──────────────────────────────────────────────

function IconChat() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconStream() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
    </svg>
  );
}
function IconTool() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function IconPrompt() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconCpu() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" />
      <path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" />
    </svg>
  );
}
function IconSplit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
    </svg>
  );
}
function IconEmbed() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" /><rect width="18" height="18" x="3" y="4" rx="2" /><circle cx="12" cy="10" r="2" /><line x1="8" x2="8" y1="2" y2="4" /><line x1="16" x2="16" y1="2" y2="4" />
    </svg>
  );
}
function IconDb() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}
function IconGateway() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
    </svg>
  );
}
function IconBrain() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M17.599 6.5a3 3 0 0 0 .399-1.375" /><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" /><path d="M3.477 10.896a4 4 0 0 1 .585-.396" /><path d="M19.938 10.5a4 4 0 0 1 .585.396" /><path d="M6 18a4 4 0 0 1-1.967-.516" /><path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
function IconX() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

// ── Connector arrow ──────────────────────────────────────────────────

function ConnectorArrow() {
  return (
    <div className="flex justify-center py-1">
      <svg width="2" height="28" viewBox="0 0 2 28" className="text-muted-foreground/50">
        <line x1="1" y1="0" x2="1" y2="22" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points="0,22 2,22 1,28" fill="currentColor" />
      </svg>
    </div>
  );
}

// ── Horizontal flow arrow ────────────────────────────────────────────

function HArrow() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" className="text-muted-foreground/50 shrink-0 mx-0.5">
      <line x1="0" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
      <polygon points="18,3 18,9 24,6" fill="currentColor" />
    </svg>
  );
}

// ── Node card (clickable) ────────────────────────────────────────────

interface NodeCardProps {
  nodeId: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accentClass: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  hasDetails: boolean;
}

function NodeCard({ nodeId, icon, title, subtitle, accentClass, isSelected, onSelect, hasDetails }: NodeCardProps) {
  return (
    <button
      onClick={() => hasDetails && onSelect(nodeId)}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-sm min-w-[140px] text-left transition-all ${accentClass} ${
        hasDetails ? "cursor-pointer hover:shadow-md hover:scale-[1.02]" : "cursor-default"
      } ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background shadow-md" : ""}`}
    >
      <div className="shrink-0 opacity-80">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight truncate">{title}</p>
        {subtitle && (
          <p className="text-[10px] leading-tight opacity-70 truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {hasDetails && (
        <svg xmlns="http://www.w3.org/2000/svg" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </button>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────

function DetailPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const detail = NODE_DETAILS[nodeId];
  if (!detail) return null;

  const hasSDK = (detail.sdkImports && detail.sdkImports.length > 0) || (detail.sdkUsage && detail.sdkUsage.length > 0);

  return (
    <div className="w-80 lg:w-96 border-l border-border bg-card flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3 border-b border-border shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{nodeId.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{detail.file}</p>
        </div>
        <button onClick={onClose} className="shrink-0 p-1 rounded-md hover:bg-accent transition-colors">
          <IconX />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">{detail.description}</p>

        {/* AI SDK imports */}
        {detail.sdkImports && detail.sdkImports.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
              AI SDK Imports
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detail.sdkImports.map((imp) => (
                <span key={imp} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono border border-emerald-500/20">
                  {imp}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SDK usage details */}
        {detail.sdkUsage && detail.sdkUsage.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-violet-600 dark:text-violet-400 mb-1.5">
              {hasSDK && detail.sdkImports && detail.sdkImports.length > 0 ? "How It's Used" : "Key Details"}
            </p>
            <div className="space-y-1.5">
              {detail.sdkUsage.map((u) => (
                <div key={u.fn} className="flex gap-2 text-xs">
                  <code className="shrink-0 px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] font-medium whitespace-nowrap">
                    {u.fn}
                  </code>
                  <span className="text-muted-foreground">{u.purpose}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key code snippet */}
        {detail.keyCode && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 mb-1.5">
              Key Code
            </p>
            <pre className="bg-muted rounded-lg p-3 overflow-x-auto text-[11px] font-mono leading-relaxed border border-border">
              {detail.keyCode}
            </pre>
          </div>
        )}

        {!hasSDK && !detail.keyCode && (
          <p className="text-[10px] text-muted-foreground italic">No direct AI SDK usage in this component.</p>
        )}
      </div>
    </div>
  );
}

// ── Layer zone ───────────────────────────────────────────────────────

interface LayerZoneProps {
  label: string;
  labelColor: string;
  borderColor: string;
  bgColor: string;
  children: React.ReactNode;
}

function LayerZone({ label, labelColor, borderColor, bgColor, children }: LayerZoneProps) {
  return (
    <div className={`rounded-xl border-2 ${borderColor} ${bgColor} p-4 relative`}>
      <span className={`absolute -top-3 left-4 px-2 text-[10px] font-bold uppercase tracking-widest ${labelColor} bg-background rounded`}>
        {label}
      </span>
      {children}
    </div>
  );
}

// ── Main diagram ─────────────────────────────────────────────────────

export function ArchitectureDiagram() {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    if (!diagramRef.current) return;
    setDownloading(true);
    const prev = selectedNode;
    setSelectedNode(null);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      await new Promise((r) => setTimeout(r, 100));
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = "documind-architecture.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to export diagram:", err);
    } finally {
      setSelectedNode(prev);
      setDownloading(false);
    }
  }, [selectedNode]);

  const handleSelect = useCallback((id: string) => {
    setSelectedNode((prev) => (prev === id ? null : id));
  }, []);

  const blue = "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300";
  const violet = "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300";
  const emerald = "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  const amber = "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  const slate = "border-slate-500/30 bg-slate-500/5 text-slate-700 dark:text-slate-300";

  const n = (id: string, icon: React.ReactNode, title: string, subtitle: string, accent: string) => (
    <NodeCard
      nodeId={id}
      icon={icon}
      title={title}
      subtitle={subtitle}
      accentClass={accent}
      isSelected={selectedNode === id}
      onSelect={handleSelect}
      hasDetails={!!NODE_DETAILS[id]}
    />
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Click any node to see implementation details and AI SDK usage
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={handleDownload}
          disabled={downloading}
        >
          <IconDownload />
          {downloading ? "Exporting..." : "Download PNG"}
        </Button>
      </div>

      {/* Diagram + detail sidebar */}
      <div className="flex rounded-xl border border-border bg-background overflow-hidden" style={{ minHeight: "580px" }}>
        {/* Diagram (left) */}
        <div className="flex-1 overflow-auto p-6 min-w-0">
          <div ref={diagramRef} className="min-w-[540px] space-y-0 p-2" style={{ backgroundColor: "var(--background)" }}>

            <LayerZone label="Client Layer" labelColor="text-blue-600 dark:text-blue-400" borderColor="border-blue-500/20" bgColor="bg-blue-500/[0.03]">
              <div className="flex flex-wrap items-center gap-3 justify-center">
                {n("chat-ui", <IconChat />, "Chat UI", "useChat + streaming", blue)}
                {n("kb", <IconBook />, "Knowledge Base", "Browse & search docs", blue)}
                {n("eval-suite", <IconCheck />, "Eval Suite", "19 test cases", blue)}
              </div>
            </LayerZone>

            <ConnectorArrow />

            <LayerZone label="API Layer" labelColor="text-violet-600 dark:text-violet-400" borderColor="border-violet-500/20" bgColor="bg-violet-500/[0.03]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3 justify-center">
                  {n("api-chat", <IconStream />, "POST /api/chat", "streamText() + rate limit", violet)}
                  {n("api-eval", <IconCpu />, "POST /api/eval", "generateText()", violet)}
                </div>
                <div className="flex flex-wrap items-center gap-3 justify-center">
                  {n("rate-limiter", <IconDb />, "Rate Limiter", "Upstash · 20 req/min", violet)}
                  {n("chat-persistence", <IconDb />, "Chat Persistence", "Neon · sessions + messages", violet)}
                </div>
              </div>
            </LayerZone>

            <ConnectorArrow />

            <LayerZone label="Workflow Layer" labelColor="text-rose-600 dark:text-rose-400" borderColor="border-rose-500/20" bgColor="bg-rose-500/[0.03]">
              <div className="flex flex-wrap items-center gap-3 justify-center">
                {n("workflows", <IconSplit />, "Vercel Workflows", "4 durable pipelines + crons", "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300")}
                {n("flags", <IconCheck />, "Feature Flags", "Vercel Flags SDK · model gating", "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300")}
              </div>
            </LayerZone>

            <ConnectorArrow />

            <LayerZone label="AI Layer" labelColor="text-emerald-600 dark:text-emerald-400" borderColor="border-emerald-500/20" bgColor="bg-emerald-500/[0.03]">
              <div className="flex flex-wrap items-center gap-3 justify-center">
                {n("retrieve-tool", <IconTool />, "retrieveDocuments", "Tool calling + Zod schema", emerald)}
                {n("system-prompt", <IconPrompt />, "System Prompt", "6 rules, citation format", emerald)}
                {n("model-config", <IconCpu />, "Model Config", "Nano / 4o Mini / Claude", emerald)}
              </div>
            </LayerZone>

            <ConnectorArrow />

            <LayerZone label="Data Layer" labelColor="text-amber-600 dark:text-amber-400" borderColor="border-amber-500/20" bgColor="bg-amber-500/[0.03]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1 justify-center">
                  {n("chunker", <IconSplit />, "Chunker", "~500 tokens, 50 overlap", amber)}
                  <HArrow />
                  {n("embeddings", <IconEmbed />, "Embeddings", "text-embedding-3-small", amber)}
                  <HArrow />
                  {n("vector-store", <IconDb />, "Vector Store", "Neon pgvector, persistent", amber)}
                </div>
                <div className="flex flex-wrap items-center gap-3 justify-center">
                  {n("markdown-docs", <IconFile />, "5 Markdown Docs", "Deployment, Incidents, Auth, Onboarding, DB", amber)}
                  {n("vercel-blob", <IconFile />, "User Uploads", "Vercel Blob · PDF/DOCX/MD", amber)}
                </div>
              </div>
            </LayerZone>

            <ConnectorArrow />

            <LayerZone label="External Services" labelColor="text-slate-600 dark:text-slate-400" borderColor="border-slate-500/20" bgColor="bg-slate-500/[0.03]">
              <div className="space-y-3">
                <div className="flex justify-center">
                  {n("ai-gateway", <IconGateway />, "Vercel AI Gateway", "Routes to providers", slate)}
                </div>
                <div className="flex flex-wrap items-center gap-3 justify-center">
                  {n("gpt-nano", <IconBrain />, "GPT-4.1 Nano", "$0.10 / $0.40 per 1M", slate)}
                  {n("gpt-mini", <IconBrain />, "GPT-4o Mini", "$0.15 / $0.60 per 1M", slate)}
                  {n("claude-sonnet", <IconBrain />, "Claude Sonnet 4.5", "$3 / $15 per 1M · thinking", slate)}
                  {n("embed-model", <IconEmbed />, "text-embedding-3-small", "1536 dimensions", slate)}
                </div>
              </div>
            </LayerZone>

          </div>
        </div>

        {/* Detail sidebar (right) */}
        {selectedNode && (
          <DetailPanel nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/30" /> Client
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500/30" /> API
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/30" /> Workflows
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/30" /> AI
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/30" /> Data
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-500/30" /> External
        </div>
        <span className="ml-auto">Click a node for details</span>
      </div>
    </div>
  );
}
