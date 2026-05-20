// ── FEATURE FLAGS: VERCEL FLAGS SDK ────────────────────────────────────
//
// Flags are defined here and evaluated server-side in App Router page/layout
// components. The Flags SDK fetches definitions from Vercel at build time
// and bundles them into the deployment — so flag reads work even if the
// Vercel Flags service is temporarily unreachable.
//
// Why server-side evaluation only:
// Flag values can carry business logic (billing tier, rollout %) that must
// not be exposed to the client. Evaluating server-side and passing down
// only the resulting allowed state keeps the control plane private.
//
// Adapter strategy: vercelAdapter() reads the FLAGS env var that Vercel
// provisions when you create a flag in the Dashboard (Flags → New Flag).
// Until that flag exists in the Dashboard, FLAGS is absent and the SDK
// throws at module load time. The fallback `decide` returns the defaultValue
// so the app works from first deploy — a new flag in the Dashboard is an
// opt-in upgrade, not a required pre-condition.
//
// Observability: the SDK auto-reports every flag evaluation to Vercel Web
// Analytics — no manual instrumentation needed. You can see which variant
// each user received and correlate it with performance metrics in the
// Vercel dashboard.
//
// To activate Dashboard-driven control:
// 1. Go to Vercel Dashboard → Flags → New Flag
// 2. Create each flag with the key below (type: boolean)
// 3. Run `vercel env pull` to sync the auto-provisioned FLAGS env var locally
import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

// Wraps vercelAdapter() with a graceful fallback for environments where
// the FLAGS env var has not been provisioned yet (pre-Dashboard setup).
// Once flags are created in the Vercel Dashboard, the adapter activates
// automatically on the next deployment pull.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeVercelAdapter(): any {
  try {
    return vercelAdapter();
  } catch {
    return undefined;
  }
}

const adapter = safeVercelAdapter();

function createBooleanFlag(input: { key: string; description: string }) {
  if (adapter) {
    return flag<boolean>({
      key: input.key,
      adapter,
      defaultValue: false,
      description: input.description,
    });
  }

  return flag<boolean>({
    key: input.key,
    decide: () => false,
    defaultValue: false,
    description: input.description,
  });
}

// Gates the premium model tier in the chat model selector.
// When OFF: only GPT-4.1 Nano is available, minimising AI Gateway spend.
// When ON: GPT-4o Mini and Claude Sonnet 4.5 appear. Claude Sonnet 4.5
// supports extended thinking — the AI SDK surfaces reasoning tokens as a
// collapsible "Thought" block in the chat UI, matching the v0 pattern.
// Use this to control model availability per environment or for staged
// rollouts. Default OFF so deployments don't silently enable more expensive
// models without a deliberate decision in the Vercel Dashboard.
export const premiumModelEnabled = createBooleanFlag({
  key: "premium-model-enabled",
  description:
    "Enables GPT-4o Mini and Claude Sonnet 4.5 (with reasoning trace) in the model selector. Off by default to control AI Gateway spend.",
});

// Gates the /eval page entirely.
// Evaluation runs call the AI Gateway for every test case — at scale this
// is meaningful spend. Keeping it off in production prevents accidental
// runs and reserves the suite for CI pipelines and admin use.
// The eval-runner component already notes this constraint in its comments.
// Default OFF — enable per-environment in the Vercel Dashboard when needed.
export const evalSuiteEnabled = createBooleanFlag({
  key: "eval-suite-enabled",
  description:
    "Gates the Evaluation Suite page. Each run costs AI Gateway credits — keep off in production unless intentional.",
});
