import type { DocIcon } from "@/lib/constants";

export type DocumentSourceType = "static" | "upload";
export type UploadStatus = "pending" | "processing" | "ready" | "failed";

export interface KnowledgeBaseDocument {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: DocIcon;
  source: string;
  sourceType: DocumentSourceType;
  updatedAt: string;
  sizeBytes: number | null;
  status?: UploadStatus;
  error?: string | null;
}

