import { useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";

import { DOCUMENT_TYPES, type DocumentType } from "~/lib/documents";
import { generateDocumentFn, saveDocument } from "~/lib/server";

export const Route = createFileRoute("/dashboard/documents/new")({
  component: NewDocumentPage,
});

type Step = "select-type" | "fill-details" | "review";

export default function NewDocumentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("select-type");
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [caseDetails, setCaseDetails] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState("");
  const [error, setError] = useState("");

  const config = selectedType
    ? DOCUMENT_TYPES.find((dt) => dt.id === selectedType)
    : null;

  const handleSelectType = (type: DocumentType) => {
    setSelectedType(type);
    setCaseDetails({});
    setGeneratedContent("");
    setStep("fill-details");
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setCaseDetails((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleGenerate = async () => {
    if (!selectedType || !config) return;
    for (const field of config.fields) {
      if (field.required && !caseDetails[field.id]?.trim()) {
        setError(`"${field.label}" is required`);
        return;
      }
    }

    setGenerating(true);
    setError("");

    try {
      const result = await generateDocumentFn({
        data: { documentType: selectedType, caseDetails },
      });
      setGeneratedContent(result.content);
      setModel(result.model);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedType || !config) return;
    setSaving(true);

    try {
      const result = await saveDocument({
        data: {
          title: `${config.label} — ${caseDetails[config.fields[0]?.id] || "Untitled"}`,
          documentType: selectedType,
          content: generatedContent,
          caseDetails,
        },
      });
      await navigate({
        to: "/dashboard/documents/$docId",
        params: { docId: result.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const steps: Step[] = ["select-type", "fill-details", "review"];
  const stepLabels: Record<Step, string> = {
    "select-type": "Choose Type",
    "fill-details": "Fill Details",
    review: "Review",
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Generate New Document</h1>
        <p className="mt-1 text-muted-foreground">
          {step === "select-type" && "Select a document type to get started."}
          {step === "fill-details" && "Fill in the case details below."}
          {step === "review" && "Review and edit the generated document."}
        </p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                s === step
                  ? "bg-primary-600 text-white"
                  : steps.indexOf(step) >= i
                    ? "bg-primary-100 text-primary-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs font-medium ${s === step ? "text-foreground" : "text-muted-foreground"}`}
            >
              {stepLabels[s]}
            </span>
            {i < 2 && <div className="h-px w-6 bg-muted" />}
          </div>
        ))}
      </div>

      {step === "select-type" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DOCUMENT_TYPES.map((dt) => (
            <button
              key={dt.id}
              type="button"
              onClick={() => handleSelectType(dt.id as DocumentType)}
              className="rounded-xl border p-5 text-left transition-all hover:border-primary-300 hover:shadow-sm"
            >
              <h3 className="font-semibold">{dt.label}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {dt.description}
              </p>
              <p className="mt-2 text-xs text-primary-600">
                {dt.fields.length} field{dt.fields.length !== 1 ? "s" : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {step === "fill-details" && config && (
        <div className="space-y-6">
          <div className="rounded-xl border p-6">
            <h2 className="mb-4 text-lg font-semibold">{config.label}</h2>
            <div className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.id}>
                  <label htmlFor={`doc-${field.id}`} className="block text-sm font-medium">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={`doc-${field.id}`}
                      value={caseDetails[field.id] ?? ""}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                      rows={3}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={`doc-${field.id}`}
                      value={caseDetails[field.id] ?? ""}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`doc-${field.id}`}
                      type={field.type === "date" ? "date" : "text"}
                      value={caseDetails[field.id] ?? ""}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Document"}
            </button>
            <button
              type="button"
              onClick={() => setStep("select-type")}
              className="rounded-lg border px-6 py-2 text-sm font-medium hover:bg-muted"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <div className="rounded-xl border">
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
              <span className="text-xs text-muted-foreground">
                Generated via {model || "AI"}
              </span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Regenerate
              </button>
            </div>
            <textarea
              value={generatedContent}
              onChange={(e) => setGeneratedContent(e.target.value)}
              className="min-h-[500px] w-full resize-y rounded-b-xl border-0 p-4 font-mono text-sm leading-relaxed focus:outline-none"
              placeholder="Generated document will appear here..."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !generatedContent}
              className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Document"}
            </button>
            <button
              type="button"
              onClick={() => setStep("fill-details")}
              className="rounded-lg border px-6 py-2 text-sm font-medium hover:bg-muted"
            >
              Edit Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
