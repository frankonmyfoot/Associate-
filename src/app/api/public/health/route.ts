import { NextResponse } from "next/server";

// GET /api/public/health — public health/diagnostics endpoint.
// Reports only *presence* of configured secrets (never values) so the deploy
// can be smoke-tested without leaking credentials.
//
//   GET /api/public/health
//   GET /api/public/health?probe=openai   (optionally verify the OpenAI key)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe");

  let openaiProbe: string | undefined;
  const openAiKey = process.env.OPENAI_API_KEY;

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

  return NextResponse.json({
    status: "ok",
    app: "associateai",
    nodeEnv: process.env.NODE_ENV ?? null,
    hasClerkSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
    hasClerkPublishableKey: Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    ),
    hasOpenAiApiKey: Boolean(openAiKey),
    hasAnthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    openaiProbe: openaiProbe ?? null,
    timestamp: new Date().toISOString(),
  });
}
