import { ArchitectureDiagram } from "@/components/architecture/architecture-diagram";

export default function ArchitecturePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            System Architecture
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            End-to-end production architecture for DocuMind, including
            persistent retrieval, rate limiting, and durable Workflow pipelines
            from user request through grounded response.
          </p>
        </div>
        <ArchitectureDiagram />
      </div>
    </div>
  );
}
