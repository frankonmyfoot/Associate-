import { useEffect, useState } from "react";
import {
  Link,
  createFileRoute,
  useRouter,
} from "@tanstack/react-router";

import { DOCUMENT_TYPES } from "~/lib/documents";
import { fmtDate } from "~/lib/fmt";
import { getDocument, updateDocument } from "~/lib/server";

export const Route = createFileRoute("/dashboard/documents/$docId")({
  loader: async ({ params }) => {
    try {
      return await getDocument({ data: { docId: params.docId } });
    } catch {
      return {
        mode: "not-found" as const,
        doc: {
          id: "",
          title: "",
          documentType: "",
          content: "",
          caseDetails: {},
          status: "",
          createdAt: "",
        },
      };
    }
  },
  component: DocumentDetailPage,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  finalized: "bg-green-100 text-green-700",
  archived: "bg-muted text-muted-foreground",
};

function DocumentDetailPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [doc, setDoc] = useState<(typeof data)["doc"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data.mode === "ok") {
      setDoc(data.doc);
      setContent(data.doc.content);
      setTitle(data.doc.title);
    }
  }, [data]);

  if (data.mode === "not-found" || data.mode === "no-firm") {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">
          {data.mode === "no-firm"
            ? "Your account isn't linked to a firm yet."
            : "Document not found."}
        </p>
        <Link
          to="/dashboard/documents"
          className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700"
        >
          ← Back to documents
        </Link>
      </div>
    );
  }

  const typeConfig = doc
    ? DOCUMENT_TYPES.find((dt) => dt.id === doc.documentType)
    : null;

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    setError("");
    try {
      await updateDocument({ data: { docId: doc.id, title, content } });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!doc) return;
    try {
      await updateDocument({ data: { docId: doc.id, status } });
      setDoc({ ...doc, status });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  };

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(
      `<html><head><title>${title.replace(/[<>&]/g, "")}</title><style>body{font-family:'Times New Roman',Times,serif;padding:2in 1in;line-height:1.6}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><pre></pre></body></html>`,
    );
    const pre = printWindow.document.body.querySelector("pre");
    if (pre) pre.textContent = content;
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/dashboard/documents"
        className="text-sm text-primary-600 hover:text-primary-700"
      >
        ← Back to documents
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border-0 bg-transparent p-0 text-2xl font-bold focus:outline-none"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {typeConfig?.label ?? doc?.documentType ?? ""} · Created{" "}
            {fmtDate(doc?.createdAt)}
          </p>
        </div>
        {doc && (
          <span
            className={`ml-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[doc.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {doc.status}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {doc?.status === "draft" && (
          <button
            type="button"
            onClick={() => handleStatusChange("finalized")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Mark as Finalized
          </button>
        )}
        {doc && doc.status !== "archived" && (
          <button
            type="button"
            onClick={() => handleStatusChange("archived")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Archive
          </button>
        )}
        {doc?.status === "archived" && (
          <button
            type="button"
            onClick={() => handleStatusChange("draft")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Restore to Draft
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {copied ? "Copied!" : "Copy Content"}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Print / PDF
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {doc && Object.keys(doc.caseDetails).length > 0 && (
        <div className="mt-6 rounded-xl border bg-muted/20 p-4">
          <h3 className="text-sm font-semibold">Case Details</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(doc.caseDetails).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="text-muted-foreground">{key}: </span>
                {value}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border">
        <div className="border-b bg-muted/20 px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {typeConfig ? typeConfig.label : "Document"} content
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[600px] w-full resize-y rounded-b-xl border-0 p-4 font-mono text-sm leading-relaxed focus:outline-none"
        />
      </div>
    </div>
  );
}
