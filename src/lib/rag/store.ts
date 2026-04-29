import { ChunkMetadata } from "./chunker";
import { loadDocuments } from "./documents";
import { chunkDocuments } from "./chunker";
import { generateChunkEmbeddings } from "./embeddings";

// ── IN-MEMORY VECTOR STORE (SINGLETON, LAZY INIT) ──────────────────────
//
// Why lazy init instead of build-time: avoids blocking deployment and
// keeps cold starts fast for pages that don't need AI (KB, architecture).
// The first chat query pays the embedding cost (~2-3s for 5 docs).
//
// Why singleton: without it, parallel requests on cold start would each
// call the embedding API independently — wasting credits and causing
// race conditions. The initPromise pattern ensures exactly one init.
//
// PRODUCTION: Replace with a managed vector DB (Pinecone, Weaviate,
// Qdrant, or pgvector). The retrieval interface (retrieveRelevantChunks)
// is abstracted so swapping the backing store requires minimal changes.

export interface StoredChunk {
  text: string;
  embedding: number[];
  metadata: ChunkMetadata;
}

let store: StoredChunk[] | null = null;
let initPromise: Promise<void> | null = null;

async function initializeStore(): Promise<void> {
  const documents = loadDocuments();
  const chunks = chunkDocuments(documents);
  const embeddedChunks = await generateChunkEmbeddings(chunks);

  store = embeddedChunks.map(({ chunk, embedding }) => ({
    text: chunk.text,
    embedding,
    metadata: chunk.metadata,
  }));

  console.log(`[DocuMind] Vector store initialized with ${store.length} chunks`);
}

export async function getStore(): Promise<StoredChunk[]> {
  if (store) return store;

  if (!initPromise) {
    initPromise = initializeStore();
  }
  await initPromise;

  return store!;
}
