import { useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useUser } from "@clerk/clerk-react";

import { GatePanel } from "~/components/ui";
import { getPublicConfig, onboardFirm } from "~/lib/server";

export const Route = createFileRoute("/onboarding")({
  loader: async () => {
    try {
      const cfg = await getPublicConfig();
      return { clerkKey: cfg.clerkPublishableKey };
    } catch {
      return { clerkKey: null };
    }
  },
  component: OnboardingPage,
});

export default function OnboardingPage() {
  const { clerkKey } = Route.useLoaderData();

  // No Clerk hooks above this gate — useUser() throws without a provider.
  if (!clerkKey) {
    return (
      <GatePanel
        title="Authentication not configured yet"
        message="Firm onboarding requires a signed-in account, and this deployment doesn't have Clerk keys connected yet. Once the owner connects Clerk keys, this wizard signs your firm up end-to-end."
      />
    );
  }
  return <OnboardingWizard />;
}

function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState(1);
  const [firmName, setFirmName] = useState("");
  const [practiceAreas, setPracticeAreas] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError("");

    try {
      await onboardFirm({
        data: {
          firmName,
          practiceAreas,
          teamSize,
          userName: user.fullName ?? user.username ?? "",
          userEmail: user.primaryEmailAddress?.emailAddress ?? "",
        },
      });
      await navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg rounded-xl border bg-background p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome to AssociateAI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoaded && !user
              ? "Sign in first — then this wizard sets up your firm."
              : "Let's set up your firm in just a few steps."}
          </p>
        </div>

        {(!isLoaded || !user) && (
          <p className="mb-6 text-center text-sm text-red-600">
            You need to sign in before completing onboarding.
          </p>
        )}

        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  s <= step
                    ? "bg-primary-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-8 ${s < step ? "bg-primary-600" : "bg-muted"}`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div>
              <label htmlFor="firm-name" className="block text-sm font-medium">
                Firm Name
              </label>
              <input
                id="firm-name"
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Smith & Associates, P.C."
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Your firm's legal or d/b/a name.
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!firmName.trim()}
                className="mt-4 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <label
                htmlFor="practice-areas"
                className="block text-sm font-medium"
              >
                Practice Areas
              </label>
              <textarea
                id="practice-areas"
                value={practiceAreas}
                onChange={(e) => setPracticeAreas(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                rows={3}
                placeholder="e.g. Personal Injury, Family Law, Criminal Defense, Real Estate..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                What areas of law does your firm practice? Separate with commas.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label htmlFor="team-size" className="block text-sm font-medium">
                Team Size
              </label>
              <select
                id="team-size"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                required
              >
                <option value="">Select team size...</option>
                <option value="1">Just me (solo practitioner)</option>
                <option value="2-5">2–5 attorneys</option>
                <option value="6-15">6–15 attorneys</option>
                <option value="16-50">16–50 attorneys</option>
                <option value="50+">50+ attorneys</option>
              </select>

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || !teamSize}
                  className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? "Setting up..." : "Complete Setup"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
