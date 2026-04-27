import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";

export default function ChatPage() {
  return (
    <Suspense>
      <ChatInterface />
    </Suspense>
  );
}
