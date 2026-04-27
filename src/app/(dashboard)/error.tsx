"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DocuMind] Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md px-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-1">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-4">
          An unexpected error occurred. This has been logged for investigation.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <Button onClick={reset} size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
