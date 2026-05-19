# DocuMind — Enterprise Knowledge Assistant

DocuMind is a production-oriented AI knowledge assistant for engineering teams. It delivers grounded answers from internal documentation with persistent retrieval, durable workflows, spend controls, and auditable chat history.

## Executive Summary

- **Persistent RAG**: Neon Postgres + pgvector eliminates cold-start re-embedding and keeps retrieval state durable.
- **Cost and abuse protection**: Upstash rate limiting protects `/api/chat` from unbounded spend.
- **Durable operations**: Workflow pipelines handle ingestion, reindexing, and maintenance outside request paths.
- **Enterprise traceability**: Chat sessions persist server-side with usage metadata and source-backed responses.
- **Vercel-native architecture**: AI SDK + AI Gateway + Marketplace storage + Workflow DevKit.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js App                              │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │   Chat   │  │ Knowledge│  │   Eval   │  │ Architecture │    │
│  │  (/chat) │  │   Base   │  │  (/eval) │  │ (/architect- │    │
│  │          │  │  (/kb)   │  │          │  │    ure)      │    │
│  └────┬─────┘  └──────────┘  └─────┬────┘  └──────────────┘    │
│       │                            │                             │
│       ┌────────────────────────────┘                             │
│       │                                                          │
│  ┌────▼─────────────────────────────────┐                       │
│  │        API Routes (Node.js)           │                       │
│  │  /api/chat (streamText)               │                       │
│  │  /api/eval (generateText)             │                       │
│  └────┬──────────────────────┬──────────┘                       │
│       │                      │                                   │
│  ┌────▼───────────┐  ┌──────▼────────┐                          │
│  │  Tool Calling   │  │  RAG Pipeline  │                         │
│  │  retrieveDocs   │──│  Embed → Search│                         │
│  └────────────────┘  └──────┬────────┘                          │
│                              │                                   │
│                     ┌────────▼────────┐                          │
│                     │  Vector Store   │                          │
│                     │  Neon pgvector  │                          │
│                     └────────┬────────┘                          │
│                              │                                   │
│                     ┌────────▼───────┐                           │
│                     │  Markdown Docs  │                          │
│                     └────────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │    Vercel AI Gateway    │
              │  OpenAI + Anthropic LLM │
              │ text-embedding-3-small  │
              └─────────────────────────┘
```

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **AI**: Vercel AI SDK v6 (`ai`, `@ai-sdk/react`) via AI Gateway
- **Storage**: Neon Postgres + `pgvector`
- **Rate limiting**: Upstash Redis + `@upstash/ratelimit`
- **Durable jobs**: Workflow DevKit (`workflow`)
- **Deployment**: Vercel

## Production-Ready Features

### Chat Experience (`/chat`)
- Streaming responses via `streamText` + `useChat`
- Server-side chat session persistence (refresh-safe history)
- Source citations and confidence indicators for trust
- Model selector with per-query cost metadata

### RAG and Retrieval
- Section-aware document chunking with overlap
- Persistent embeddings in Neon (`rag_chunks`)
- pgvector similarity search (`embedding <=> query`)
- Tool-driven retrieval (`retrieveDocuments`) with bounded tool loops

### Durable Workflows
- `POST /api/workflows/rag/ingest`: incremental ingestion
- `POST /api/workflows/rag/reindex`: full embedding refresh
- `POST /api/workflows/chat/maintenance`: retention cleanup

### Security and Spend Controls
- Per-user/IP sliding-window rate limiting on `/api/chat`
- AI Gateway request tagging (`feature:*`, `app:documind`) for observability
- Guardrails for missing critical env vars at runtime

## Running Locally

```bash
# Clone the repo
git clone <repo-url>
cd documind

# Install dependencies
npm install

# Configure env vars
cp .env.local.example .env.local
# Add AI Gateway auth, DATABASE_URL, and Upstash Redis vars

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key Technical Decisions

### Why persistent pgvector instead of in-memory vectors?
Persistent retrieval removes recurring cold-start embedding cost, improves first-response latency, and provides durable/auditable state.

### Why tool-based retrieval?
The LLM decides when retrieval is needed and can iteratively refine searches while staying grounded in internal documents.

### Why AI Gateway model strings?
Plain `provider/model` strings keep provider switching simple and preserve centralized gateway observability and controls.

### Why Workflow for ingestion and maintenance?
Long-running indexing and cleanup jobs should be durable, retryable, and decoupled from user-facing request latency.

## Next Improvements

- Replace demo cookie auth with SSO-ready identity integration (Clerk/Auth0/Descope)
- Add document CRUD and ingestion from external content sources
- Add hybrid retrieval (vector + BM25) and reranking
- Introduce richer observability with OTEL traces and alerts
- Upgrade evaluation from substring checks to semantic judge-based scoring

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_GATEWAY_API_KEY` | AI Gateway API key (optional if using OIDC token) | No* |
| `VERCEL_OIDC_TOKEN` | OIDC token from `vercel env pull` for AI Gateway auth | No* |
| `DATABASE_URL` | Neon Postgres connection string for vectors + chat persistence | Yes |
| `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL` | Upstash Redis REST URL for rate limiting | Yes |
| `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN` | Upstash Redis REST token for rate limiting | Yes |
| `BASIC_AUTH_USERNAME` | Optional demo auth username | No |
| `BASIC_AUTH_PASSWORD` | Optional demo auth password | No |

\*At least one of `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` is required.

## License

MIT
