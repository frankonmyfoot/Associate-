// Health/diagnostics payload shared by the production server (serve.ts).
// NOTE: this TanStack Start version (1.168) dropped `createAPIFileRoute` — file
// routes can no longer serve raw JSON paths — so the published health endpoint
// is intercepted in serve.ts before the SSR handler. This module holds the
// logic so the payload stays in one place.
//
// Reports only *presence* of configured secrets (booleans and env-var NAMES,
// never values) so the deploy can be smoke-tested without leaking credentials.

export async function buildHealthResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe");

  const openAiKey = process.env.OPENAI_API_KEY;
  let openaiProbe: string | null = null;

  if (probe === "openai" && openAiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openAiKey}` },
        cache: "no-store",
      });
      openaiProbe = res.ok
        ? "ok"
        : `error ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (err) {
      openaiProbe = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  } else if (probe === "openai") {
    openaiProbe = "error: OPENAI_API_KEY not set";
  }

  // Candidate secret names — presence only.
  const candidates = [
    "CLERK_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "VITE_CLERK_PUBLISHABLE_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "DATABASE_URL",
  ];
  const present: Record<string, boolean> = {};
  for (const name of candidates) {
    present[name] = Boolean(process.env[name]);
  }

  // Env var NAMES (never values) that look secret-related, to surface any
  // unexpected naming the owner used.
  const secretLikeNames = Object.keys(process.env)
    .filter((n) =>
      /clerk|openai|anthropic|secret|api[-_]?key|publishable|database|db[-_]?url|neon/i.test(
        n,
      ),
    )
    .sort();

  return new Response(
    JSON.stringify(
      {
        status: "ok",
        app: "associateai",
        nodeEnv: process.env.NODE_ENV ?? null,
        present,
        secretLikeNames,
        openaiProbe,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
