import { ChunkMetadata } from "./chunker";
import { loadDocuments } from "./documents";
import { chunkDocuments } from "./chunker";
import { generateChunkEmbeddings } from "./embeddings";

// PRODUCTION: Replace this in-memory store with a managed vector database
// (Pinecone, Weaviate, Qdrant, or pgvector). The retrieval interface is
// abstracted so swapping the backing store requires minimal code changes.

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

  // Singleton initialization — only one request pays the embedding cost
  if (!initPromise) {
    initPromise = initializeStore();
  }
  await initPromise;

  return store!;
}
