// ── DOCUMENT LOADER: FILESYSTEM-BASED ──────────────────────────────────
//
// Reads markdown files from src/data/docs/ using fs.readFileSync.
// This is why the API route uses runtime = "nodejs", not Edge.
// Title mapping is hardcoded — slugs match filenames by convention.
//
// PRODUCTION: Load from a CMS, S3, or database. Support incremental
// ingestion, versioning, and per-team access control.

import fs from "fs";
import path from "path";

export interface DocumentMetadata {
  title: string;
  source: string;
}

export interface RawDocument {
  content: string;
  metadata: DocumentMetadata;
}

const DOCS_DIR = path.join(process.cwd(), "src/data/docs");

const DOCUMENT_TITLES: Record<string, string> = {
  "deployment-runbook.md": "Deployment Runbook",
  "incident-response.md": "Incident Response Guide",
  "api-auth-guide.md": "API Authentication Guide",
  "onboarding-checklist.md": "New Engineer Onboarding Checklist",
  "database-migrations.md": "Database Migration Procedures",
};

export function loadDocuments(): RawDocument[] {
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));

  return files.map((filename) => {
    const content = fs.readFileSync(path.join(DOCS_DIR, filename), "utf-8");
    return {
      content,
      metadata: {
        title: DOCUMENT_TITLES[filename] || filename,
        source: filename,
      },
    };
  });
}

export function loadDocumentBySlug(slug: string): RawDocument | null {
  const filename = `${slug}.md`;
  const filepath = path.join(DOCS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  const content = fs.readFileSync(filepath, "utf-8");
  return {
    content,
    metadata: {
      title: DOCUMENT_TITLES[filename] || slug,
      source: filename,
    },
  };
}
