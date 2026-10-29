import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import SiteHeader from "~/components/site-header";
import DateField from "~/components/date-field";
import { DEMO_INTAKE_FIELDS } from "~/lib/demo";
import {
  generateDemoSummary,
  getSessionUser,
  type DemoSummaryResult,
} from "~/lib/server";
import type { IntakeField } from "~/lib/types";

export const Route = createFileRoute("/demo")({
  loader: async () => {
    try {
      return { user: await getSessionUser() };
    } catch {
      return { user: null };
    }
  },
  component: DemoPage,
});

function DemoPage() {
  const data = Route.useLoaderData();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DemoSummaryResult | null>(null);

  const handleChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const summary = await generateDemoSummary({ data: { data: formData } });
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFormData({});
    setResult(null);
    setError("");
  };

  const renderField = (field: IntakeField) => {
    const value = formData[field.id] ?? "";
    const inputId = `demo-${field.id}`;
    const onChange = (v: string) => handleChange(field.id, v);

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            rows={4}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
      case "date":
        return <DateField id={inputId} value={value} onChange={onChange} />;
      default:
        return (
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={field.placeholder}
            required={field.required}
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={data.user} />

      {/* The pitch banner — factual only: Starter really is $49/mo. */}
      <div className="bg-primary-600 px-4 py-3 text-center">
        <p className="mx-auto max-w-3xl text-sm text-white">
          This is a live demo of AssociateAI. Real firms get custom intake
          forms like this in minutes — $49/mo.{" "}
          <Link
            to="/pricing"
            className="font-semibold underline underline-offset-2 hover:text-primary-100"
          >
            See pricing
          </Link>
        </p>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Try a client intake form
        </h1>
        <p className="mt-2 text-muted-foreground">
          This is a sample personal-injury intake, like the ones AssociateAI
          firms send their clients. Fill it out and see the organized,
          auto-generated case summary your firm would receive. No sign-up
          needed.
        </p>

        {/* Honest privacy notice, stated twice: here and at the submit button. */}
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Demo only — nothing you enter is saved or sent anywhere.
        </p>

        {result ? (
          <div className="mt-8">
            <div className="rounded-xl border bg-background p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                Auto-generated case summary
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.source === "ai"
                  ? "Generated with AI, just as a real submission would be."
                  : "Generated from a built-in template (this demo has no AI key configured). Firms that add an OpenAI key get an AI-written summary."}
              </p>
              <div className="mt-4 whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
                {result.summary}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                In a real firm's dashboard, this summary appears instantly with
                the submission — organized, searchable, ready for review.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Fill another intake
              </button>
              <Link
                to="/pricing"
                className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                See plans &amp; pricing
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 rounded-xl border bg-background p-6 shadow-sm"
          >
            <div className="space-y-5">
              {DEMO_INTAKE_FIELDS.map((field) => (
                <div key={field.id}>
                  <label
                    htmlFor={`demo-${field.id}`}
                    className="block text-sm font-medium"
                  >
                    {field.label}
                    {field.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                    {!field.required && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        optional
                      </span>
                    )}
                  </label>
                  {renderField(field)}
                </div>
              ))}
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? "Generating summary..." : "Submit intake"}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Demo only — nothing you enter is saved or sent anywhere.
            </p>
          </form>
        )}
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} AssociateAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
