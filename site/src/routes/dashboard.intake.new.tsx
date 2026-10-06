import { useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";

import { createIntakeForm } from "~/lib/server";
import type { IntakeField, IntakeFieldType } from "~/lib/types";

export const Route = createFileRoute("/dashboard/intake/new")({
  component: NewIntakeFormPage,
});

const FIELD_TYPES: { value: IntakeFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "file", label: "File Upload" },
];

export default function NewIntakeFormPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addField = (type: IntakeFieldType) => {
    const newField: IntakeField = {
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: "",
      placeholder: "",
      required: false,
      options: type === "select" ? [""] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<IntakeField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const addSelectOption = (fieldId: string) => {
    setFields(
      fields.map((f) =>
        f.id === fieldId ? { ...f, options: [...(f.options || []), ""] } : f,
      ),
    );
  };

  const updateSelectOption = (
    fieldId: string,
    index: number,
    value: string,
  ) => {
    setFields(
      fields.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              options: f.options?.map((opt, i) => (i === index ? value : opt)),
            }
          : f,
      ),
    );
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [
      newFields[targetIndex],
      newFields[index],
    ];
    setFields(newFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Form title is required");
      return;
    }
    if (fields.length === 0) {
      setError("Add at least one field to the form");
      return;
    }
    for (const field of fields) {
      if (!field.label.trim()) {
        setError("All fields must have a label");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const result = await createIntakeForm({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          fields: fields.map((f) => ({
            ...f,
            options: f.options?.filter((o) => o.trim()) || undefined,
          })),
        },
      });
      await navigate({ to: "/dashboard/intake/$formId", params: { formId: result.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Intake Form</h1>
        <p className="mt-1 text-muted-foreground">
          Build a custom intake form for your clients.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="form-title" className="block text-sm font-medium">
                Form Title
              </label>
              <input
                id="form-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="e.g. Personal Injury Intake"
                required
              />
            </div>
            <div>
              <label
                htmlFor="form-description"
                className="block text-sm font-medium"
              >
                Description (optional)
              </label>
              <textarea
                id="form-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                rows={2}
                placeholder="Brief description of what this form is for..."
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Form Fields</h2>
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => addField(ft.value)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  + {ft.label}
                </button>
              ))}
            </div>
          </div>

          {fields.length === 0 && (
            <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              Click any field type above to add it to your form.
            </div>
          )}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                        {FIELD_TYPES.find((ft) => ft.value === field.type)
                          ?.label ?? field.type}
                      </span>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          updateField(field.id, { label: e.target.value })
                        }
                        className="flex-1 rounded border px-2 py-1 text-sm"
                        placeholder="Field label"
                      />
                    </div>
                    <input
                      type="text"
                      value={field.placeholder ?? ""}
                      onChange={(e) =>
                        updateField(field.id, { placeholder: e.target.value })
                      }
                      className="block w-full rounded border px-2 py-1 text-sm text-muted-foreground"
                      placeholder="Placeholder text (optional)"
                    />

                    {field.type === "select" && (
                      <div className="space-y-1">
                        {field.options?.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                updateSelectOption(
                                  field.id,
                                  optIndex,
                                  e.target.value,
                                )
                              }
                              className="flex-1 rounded border px-2 py-1 text-sm"
                              placeholder={`Option ${optIndex + 1}`}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addSelectOption(field.id)}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          + Add Option
                        </button>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.required ?? false}
                        onChange={(e) =>
                          updateField(field.id, { required: e.target.checked })
                        }
                      />
                      Required
                    </label>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveField(index, "up")}
                      disabled={index === 0}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(index, "down")}
                      disabled={index === fields.length - 1}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFields(fields.filter((f) => f.id !== field.id))
                      }
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Form"}
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-lg border px-6 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
