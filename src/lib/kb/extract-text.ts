function extensionFromFilename(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/**
 * Postgres UTF-8 rejects null bytes (0x00), which PDF text streams can
 * contain when fonts embed binary ligature or glyph data. Strip them before
 * any text reaches the database.
 */
function sanitizeText(text: string) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x00/g, "");
}

async function extractPdfText(buffer: Buffer) {
  // unpdf ships a pre-bundled, worker-free build of Mozilla PDF.js designed
  // for serverless runtimes (Vercel, Cloudflare Workers, etc.). It has no
  // native dependencies and avoids the module.parent / pdf.worker.mjs
  // resolution issues that affect pdf-parse in Next.js server bundles.
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return sanitizeText(text);
}

export async function extractDocumentText(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const extension = extensionFromFilename(input.filename);

  if (extension === "md" || extension === "txt") {
    return input.buffer.toString("utf8");
  }

  if (extension === "pdf") {
    return extractPdfText(input.buffer);
  }

  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    return result.value;
  }

  throw new Error(`Unsupported file extension: .${extension}`);
}

