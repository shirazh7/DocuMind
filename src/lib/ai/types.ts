import type { UIMessage, LanguageModelUsage } from "ai";

export type MessageMetadata = {
  totalUsage?: LanguageModelUsage;
  modelId?: string;
  estimatedCost?: number;
};

export type DocuMindMessage = UIMessage<MessageMetadata>;
