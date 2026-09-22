"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents";

interface FieldValue {
  id: string;
  label: string;
  value: string;
}

export default function NewDocumentPage() {
  const router = useRouter();
  const [step, setStep] = useState<"select-type" | "fill-details" | "review">("select-type");
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [caseDetails, setCaseDetails] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState("");
  const [error, setError] = useState("");

  const config = selectedType ? DOCUMENT_TYPES.find((dt) => dt.id === selectedType) : null;

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

    // Validate required fields
    for (const field of config.fields) {
      if (field.required && !caseDetails[field.id]?.trim()) {
        setError(`"${field.label}" is required`);
        return;
      }
    }

    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: selectedType,
          caseDetails,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");

      setGeneratedContent(json.data.content);
      setModel(json.data.model);
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
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${config.label} — ${caseDetails[config.fields[0]?.id] || "Untitled"}`,
          documentType: selectedType,
          content: generatedContent,
          caseDetails,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      router.push(`/dashboard/documents/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
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

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {["select-type", "fill-details", "review"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                s === step
                  ? "bg-primary-600 text-white"
                  : ["select-type", "fill-details", "review"].indexOf(step) >= i
                    ? "bg-primary-100 text-primary-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                s === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s === "select-type"
                ? "Choose Type"
                : s === "fill-details"
                  ? "Fill Details"
                  : "Review"}
            </span>
            {i < 2 && <div className="h-px w-6 bg-muted" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Type */}
      {step === "select-type" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DOCUMENT_TYPES.map((dt) => (
            <button
              key={dt.id}
              onClick={() => handleSelectType(dt.id as DocumentType)}
              className="rounded-xl border p-5 text-left hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <h3 className="font-semibold">{dt.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {dt.description}
              </p>
              <p className="mt-2 text-xs text-primary-600">
                {dt.fields.length} field{dt.fields.length !== 1 ? "s" : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Fill Details */}
      {step === "fill-details" && config && (
        <div className="space-y-6">
          <div className="rounded-xl border p-6">
            <h2 className="mb-4 text-lg font-semibold">{config.label}</h2>
            <div className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={caseDetails[field.id] ?? ""}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                      rows={3}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={caseDetails[field.id] ?? ""}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "date" ? (
                    <input
                      type="date"
                      value={caseDetails[field.id] ?? ""}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      type="text"
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
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Document"}
            </button>
            <button
              onClick={() => setStep("select-type")}
              className="rounded-lg border px-6 py-2 text-sm font-medium hover:bg-muted"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === "review" && (
        <div className="space-y-6">
          <div className="rounded-xl border">
            <div className="border-b bg-muted/20 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Generated via {model || "AI"}
              </span>
              <button
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
              className="w-full min-h-[500px] resize-y rounded-b-xl border-0 p-4 text-sm font-mono leading-relaxed focus:outline-none"
              placeholder="Generated document will appear here..."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !generatedContent}
              className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Document"}
            </button>
            <button
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