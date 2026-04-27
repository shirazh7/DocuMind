import { KBSearch } from "@/components/kb/kb-search";

export default function KnowledgeBasePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Browse Acme Engineering&apos;s internal documentation. Select a
            document to view its contents or use the search bar to find
            specific topics.
          </p>
        </div>
        <KBSearch />
      </div>
    </div>
  );
}
