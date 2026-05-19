// ── FLAGS EXPLORER DISCOVERY ENDPOINT ──────────────────────────────────
//
// This route exposes flag metadata (keys, descriptions, options) to the
// Vercel Toolbar's Flags Explorer. During development, the Explorer lets
// you override any flag value locally without affecting other users or
// environments — no code change needed to test both variants.
//
// The endpoint is read by the Toolbar only; it does not affect flag
// evaluation in production. Exclude it from auth checks in proxy.ts if
// needed (Workflow already has a similar exclusion for .well-known/workflow).
//
// force-dynamic: the Vercel SDK reads the FLAGS env var at request time.
// That variable is provisioned by the Vercel platform after flags are
// created in the Dashboard and is not available at build time. Without
// force-dynamic, Next.js attempts static generation and the build fails.
// The discovery endpoint is only hit by the Vercel Toolbar, so no
// performance cost from opting out of static generation here.
export const dynamic = "force-dynamic";

import { createFlagsDiscoveryEndpoint } from "flags/next";
import { getProviderData } from "@flags-sdk/vercel";
import * as flags from "../../../../flags";

export const GET = createFlagsDiscoveryEndpoint(() => getProviderData(flags));
