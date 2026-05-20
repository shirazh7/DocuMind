// ── CHUNKING STRATEGY ──────────────────────────────────────────────────
//
// Split by markdown headings first (preserving section context), then by
// character count with paragraph/sentence boundary preference.
//
// ~4 chars/token is a reasonable approximation for English prose. A proper
// tokenizer (tiktoken) would be more accurate but adds ~2MB WASM — not
// justified for this workload with known-format markdown documents.
//
// 500 tokens balances context density vs retrieval precision: too small
// and chunks lack coherence; too large and irrelevant content dilutes
// similarity scores. 50-token overlap prevents losing context at chunk
// boundaries — especially mid-paragraph splits where a sentence
// references the previous one.
//
// TODO(production): Use tiktoken for accurate token counting. Tune chunk size
// informed by retrieval quality metrics from the evaluation suite.

import { RawDocument } from "./documents";

export interface ChunkMetadata {
  title: string;
  section: string;
  source: string;
  chunkIndex: number;
}

export interface TextChunk {
  text: string;
  metadata: ChunkMetadata;
}

const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

interface Section {
  heading: string;
  content: string;
}

function extractSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "Introduction";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        const content = currentContent.join("\n").trim();
        if (content.length > 0) {
          sections.push({ heading: currentHeading, content });
        }
      }
      currentHeading = headingMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    const content = currentContent.join("\n").trim();
    if (content.length > 0) {
      sections.push({ heading: currentHeading, content });
    }
  }

  return sections;
}

function splitWithOverlap(text: string): string[] {
  if (text.length <= TARGET_CHUNK_CHARS) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + TARGET_CHUNK_CHARS;

    if (end < text.length) {
      // Try to break at a paragraph boundary
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + TARGET_CHUNK_CHARS * 0.5) {
        end = paragraphBreak;
      } else {
        // Fall back to sentence boundary
        const sentenceBreak = text.lastIndexOf(". ", end);
        if (sentenceBreak > start + TARGET_CHUNK_CHARS * 0.3) {
          end = sentenceBreak + 1;
        }
      }
    } else {
      end = text.length;
    }

    chunks.push(text.slice(start, end).trim());
    start = end - OVERLAP_CHARS;

    if (start < 0) start = 0;
    if (end === text.length) break;
  }

  return chunks;
}

export function chunkDocuments(documents: RawDocument[]): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const doc of documents) {
    const sections = extractSections(doc.content);

    for (const section of sections) {
      const textParts = splitWithOverlap(section.content);

      for (const text of textParts) {
        if (text.length < 20) continue; // skip trivially small chunks

        allChunks.push({
          text,
          metadata: {
            title: doc.metadata.title,
            section: section.heading,
            source: doc.metadata.source,
            chunkIndex: globalIndex++,
          },
        });
      }
    }
  }

  return allChunks;
}
