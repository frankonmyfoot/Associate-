"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPES } from "@/lib/documents";

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    params.then((p) => setDocumentId(p.id));
  }, [params]);

  useEffect(() => {
    if (!documentId) return;
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setDoc(json.data);
          setContent(json.data.content ?? "");
          setTitle(json.data.title ?? "");
        } else {
          setError("Document not found");
        }
      })
      .catch(() => setError("Failed to load document"));
  }, [documentId]);

  const typeConfig = doc ? DOCUMENT_TYPES.find((dt) => dt.id === doc.document_type) : null;
  const statusColors: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-700",
    finalized: "bg-green-100 text-green-700",
    archived: "bg-muted text-muted-foreground",
  };

  const handleSave = async () => {
    if (!documentId) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!documentId) return;
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (res.ok) {
      setDoc((prev) => (prev ? { ...prev, status } : prev));
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; padding: 2in 1in; line-height: 1.6; }
            pre { white-space: pre-wrap; font-family: inherit; }
          </style>
        </head>
        <body><pre>${content}</pre></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!documentId) return null;
  if (error && !doc) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button onClick={() => router.push("/dashboard/documents")} className="mt-4 text-sm text-primary-600 hover:text-primary-700">
          &larr; Back to documents
        </button>
      </div>
    );
  }
  if (!doc) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-2xl font-bold border-0 p-0 focus:outline-none focus:ring-0 bg-transparent"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {typeConfig?.label ?? String(doc.document_type ?? "")} &middot;{" "}
            Created {doc.created_at ? new Date(String(doc.created_at)).toLocaleDateString() : ""}
          </p>
        </div>
        <span
          className={`ml-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            statusColors[String(doc.status)] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {String(doc.status)}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {String(doc.status) === "draft" && (
          <button
            onClick={() => handleStatusChange("finalized")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Mark as Finalized
          </button>
        )}
        {String(doc.status) !== "archived" && (
          <button
            onClick={() => handleStatusChange("archived")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Archive
          </button>
        )}
        {String(doc.status) === "archived" && (
          <button
            onClick={() => handleStatusChange("draft")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Restore to Draft
          </button>
        )}

        <button
          onClick={handleCopyContent}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {copied ? "Copied!" : "Copy Content"}
        </button>

        <button
          onClick={handlePrint}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Print / PDF
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Case Details */}
      {doc.case_details ? (
        <div className="mt-6 rounded-xl border bg-muted/20 p-4">
          <h3 className="text-sm font-semibold">Case Details</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(
              (doc.case_details as Record<string, string>) ?? {}
            ).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="text-muted-foreground">{key}: </span>
                {value}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Document Content */}
      <div className="mt-6 rounded-xl border">
        <div className="border-b bg-muted/20 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Generated via {typeConfig?.label ?? "AI"}
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-[600px] resize-y rounded-b-xl border-0 p-4 text-sm font-mono leading-relaxed focus:outline-none"
        />
      </div>
    </div>
  );
}