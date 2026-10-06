import { useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";

import { getPublicIntakeForm, submitIntake } from "~/lib/server";
import type { IntakeField } from "~/lib/types";

export const Route = createFileRoute("/intake/$formId")({
  loader: async ({ params }) => {
    try {
      return await getPublicIntakeForm({ data: { formId: params.formId } });
    } catch {
      return {
        mode: "not-found" as const,
        title: "",
        description: "",
        fields: [] as IntakeField[],
        firmName: "",
      };
    }
  },
  component: PublicIntakeFormPage,
});

function PublicIntakeFormPage() {
  const data = Route.useLoaderData();
  const { formId } = Route.useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await submitIntake({ data: { formId, data: formData } });
      await navigate({ to: "/intake/$formId/confirmation", params: { formId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  if (data.mode === "not-found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xl font-bold">This intake form is unavailable</p>
        <p className="text-sm text-muted-foreground">
          The form link may be incorrect, or the firm has deactivated it.
          Contact the firm for a fresh link.
        </p>
      </div>
    );
  }

  const renderField = (field: IntakeField) => {
    const value = formData[field.id] ?? "";
    const inputId = `pf-${field.id}`;
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
      case "select":
        return (
          <select
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            required={field.required}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "date":
        return (
          <input
            id={inputId}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            required={field.required}
          />
        );
      case "email":
        return (
          <input
            id={inputId}
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={field.placeholder || "you@example.com"}
            required={field.required}
          />
        );
      case "phone":
        return (
          <input
            id={inputId}
            type="tel"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={field.placeholder || "(555) 123-4567"}
            required={field.required}
          />
        );
      case "file":
        // Files are accepted but not uploaded anywhere yet — nothing leaves the
        // browser, so clients should be told not to rely on attachments yet.
        return (
          <div>
            <input
              id={inputId}
              type="file"
              disabled
              className="mt-1 block w-full text-sm opacity-60"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              File attachments aren't supported yet — please describe the
              document in a text field.
            </p>
          </div>
        );
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
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <span className="text-lg font-bold">AssociateAI</span>
          </div>
          {data.firmName && (
            <span className="text-sm text-muted-foreground">
              {data.firmName}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        {data.description && (
          <p className="mt-1 text-muted-foreground">{data.description}</p>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border bg-background p-6 shadow-sm"
        >
          <div className="space-y-5">
            {data.fields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={`pf-${field.id}`}
                  className="block text-sm font-medium"
                >
                  {field.label}
                  {field.required && <span className="ml-1 text-red-500">*</span>}
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
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </main>
    </div>
  );
}
