# DocuMind — Enterprise Knowledge Assistant

An AI-powered knowledge assistant that lets engineering teams ask questions in natural language and get accurate, sourced answers grounded in internal documentation.

Built as a Vercel Solutions Architect take-home assessment (Track B: AI Cloud).

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
│                     ┌────────▼───────┐                           │
│                     │  Vector Store   │                           │
│                     │  (In-Memory)    │                           │
│                     └────────┬───────┘                           │
│                              │                                   │
│                     ┌────────▼───────┐                           │
│                     │  5 Markdown     │                           │
│                     │  Documents      │                           │
│                     └────────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  Vercel AI Gateway      │
              │  GPT-4.1 Nano / 4o Mini │
              │  text-embedding-3-small │
              └─────────────────────────┘
```

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **AI**: Vercel AI SDK v5 (`ai`, `@ai-sdk/react`) via **Vercel AI Gateway**
- **Embeddings**: OpenAI `text-embedding-3-small`
- **Vector Store**: In-memory cosine similarity search
- **Deployment**: Vercel

## Features

### Chat Interface (`/chat`)
- Streaming responses via `streamText` + `useChat`
- Inline source citations (`[1]`, `[2]`) linked to a collapsible sources panel
- Confidence indicator (green/amber/red) based on retrieval similarity scores
- Model selector (GPT-4.1 Nano vs GPT-4o Mini) with per-query cost display
- Stop button for streaming interruption
- Suggested questions on empty state
- Light/dark mode with system preference detection

### RAG Pipeline
- Documents chunked by section with ~500 token target and 50 token overlap
- Embeddings generated via `text-embedding-3-small` on first request
- Top-5 cosine similarity retrieval
- Tool calling pattern: LLM decides when to retrieve via `retrieveDocuments` tool
- Multi-step reasoning with `stopWhen: stepCountIs(3)`

### Knowledge Base (`/kb`)
- Browse all 5 internal documentation files in a file-browser style table
- View full document content with rendered markdown
- Search and filter documents by title or description
- "Ask about this" button to jump into chat with context

### System Architecture (`/architecture`)
- Interactive visual diagram of the full RAG pipeline (client → API → AI → data → external services)
- Clickable nodes reveal implementation details: file paths, AI SDK imports, usage patterns, and key code snippets
- Right-hand detail sidebar with smooth slide-in animation
- Download as PNG for presentations and documentation
- Layer-grouped layout inspired by AWS architecture diagrams

### Evaluation Suite (`/eval`)
- 21 predefined test cases across 5 documentation areas
- 3 hallucination detection tests (questions not in docs)
- Grounding check: verifies expected facts appear in responses
- Per-test latency tracking and pass/fail indicators
- Overall accuracy score with category breakdown
- Sequential execution with rate limit protection (500ms delay)

### Enterprise Dashboard Shell
- Persistent sidebar navigation with collapsible Knowledge Base document list
- Responsive top bar with page titles and mobile hamburger menu
- Route group layout (`(dashboard)`) wrapping all pages
- Error boundary (`error.tsx`) with user-friendly retry UI
- Loading skeletons (`loading.tsx`) during route transitions
- Light/dark mode toggle with system preference detection

## Running Locally

```bash
# Clone the repo
git clone <repo-url>
cd documind

# Install dependencies
npm install

# Set your Vercel AI Gateway key
cp .env.local.example .env.local
# Edit .env.local and add your AI_GATEWAY_API_KEY

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the first chat message will take a few seconds while embeddings are generated.

## Key Technical Decisions

### Why tool calling for retrieval instead of injecting context directly?
The AI SDK's tool calling pattern lets the model decide *when* retrieval is needed and supports multi-step reasoning (retrieve → analyze → retrieve more). It also demonstrates a core AI SDK pattern that maps to real-world agent architectures.

### Why in-memory vector store instead of Pinecone/Weaviate?
Scoped appropriately for a demo with 5 static documents. The retrieval interface (`retrieveRelevantChunks`) is abstracted so swapping to a managed vector DB requires changing only `store.ts` and `embeddings.ts`.

### Why cosine similarity?
Industry standard for text embeddings. OpenAI's embeddings are L2-normalized, so cosine similarity and dot product are equivalent. The `cosineSimilarity` utility from the AI SDK handles this cleanly.

### Why streaming over blocking?
Streaming via `streamText` provides immediate visual feedback. Users see tokens as they arrive, dramatically reducing perceived latency. The trade-off (can't validate the full response before displaying) is mitigated by the evaluation suite which performs post-hoc grounding checks.

### Why model toggle?
Demonstrates understanding of cost/latency trade-offs. GPT-4.1 Nano for high-volume lookups (~$0.0001/query), GPT-4o Mini for complex synthesis (~$0.0003/query). In production, you'd route automatically based on query complexity.

### Why the confidence indicator?
Enterprise customers need trust signals. Low similarity scores warn users that the answer may be less reliable — especially important in regulated environments where hallucination has real consequences.

## What I'd Do With More Time

- **Persistent vector store**: Use Vercel Postgres + pgvector or Pinecone for production-grade storage
- **Authentication**: Add next-auth with SSO for enterprise identity providers
- **Conversation memory**: Persist chat history and support follow-up questions with context
- **Document CRUD**: Full upload, edit, and delete workflows (current KB is read-only with mock upload)
- **Observability**: Add Vercel OTEL integration for tracing, error tracking with Sentry
- **Hybrid search**: Combine vector search with BM25 keyword matching for better recall
- **Query rewriting**: Expand abbreviations, fix typos, and reformulate vague queries
- **Caching**: Cache frequent queries with Vercel KV, cache embeddings in a persistent store
- **Rate limiting**: Per-user rate limits with Vercel WAF or custom middleware
- **Feedback loop**: Thumbs up/down on answers to build a training signal for prompt tuning
- **RBAC & multi-tenancy**: Per-team document access control so different orgs see only their content
- **Semantic eval**: Replace substring matching with LLM-as-judge evaluation for more robust grounding checks

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key (routes to OpenAI, Anthropic, etc.) | Yes |

## License

MIT
