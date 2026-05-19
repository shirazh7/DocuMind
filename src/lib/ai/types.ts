// Shared types ensure type safety between the API route (which sends metadata
// via messageMetadata callbacks) and the client (which reads it from
// message.metadata). Without this, cost display and model attribution would
// rely on untyped `any` casts — fragile and hard to debug.
import type { UIMessage, LanguageModelUsage } from "ai";

export type MessageMetadata = {
  totalUsage?: LanguageModelUsage;
  modelId?: string;
  estimatedCost?: number;
  sessionId?: string;
  requestId?: string;
};

export type DocuMindMessage = UIMessage<MessageMetadata>;
