"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeField } from "@/types";

export default function IntakeFormClient({
  formId,
  fields,
}: {
  formId: string;
  fields: IntakeField[];
}) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, FileList | null>>({});
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
      const res = await fetch(`/api/intake/forms/${formId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: formData }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submission failed");

      router.push(`/intake/${formId}/confirmation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: IntakeField) => {
    const value = formData[field.id] ?? "";

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            id={field.id}
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            rows={4}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case "select":
        return (
          <select
            id={field.id}
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            required={field.required}
          >
            <option value="">Select...</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "date":
        return (
          <input
            type="date"
            id={field.id}
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            required={field.required}
          />
        );

      case "email":
        return (
          <input
            type="email"
            id={field.id}
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={field.placeholder || "you@example.com"}
            required={field.required}
          />
        );

      case "phone":
        return (
          <input
            type="tel"
            id={field.id}
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={field.placeholder || "(555) 123-4567"}
            required={field.required}
          />
        );

      case "file":
        return (
          <input
            type="file"
            id={field.id}
            onChange={(e) =>
              setFiles((prev) => ({ ...prev, [field.id]: e.target.files }))
            }
            className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700"
          />
        );

      default:
        return (
          <input
            type="text"
            id={field.id}
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={field.placeholder}
            required={field.required}
          />
        );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border bg-background p-6 shadow-sm"
    >
      <div className="space-y-5">
        {fields.map((field) => (
          <div key={field.id}>
            <label htmlFor={field.id} className="block text-sm font-medium">
              {field.label}
              {field.required && (
                <span className="ml-1 text-red-500">*</span>
              )}
            </label>
            {renderField(field)}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}