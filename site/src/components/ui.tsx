import { useState } from "react";
import { Link } from "@tanstack/react-router";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    reviewed: "bg-green-100 text-green-700",
    finalized: "bg-green-100 text-green-700",
    draft: "bg-yellow-100 text-yellow-700",
    archived: "bg-muted text-muted-foreground",
    active: "bg-green-100 text-green-700",
    inactive: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

export function EmptyState({
  title,
  message,
  iconPath,
  action,
}: {
  title: string;
  message: string;
  iconPath: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="mt-8 rounded-xl border p-12 text-center text-muted-foreground">
      <svg
        className="mx-auto h-12 w-12 text-muted-foreground/50"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm">{message}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => undefined);
      }}
      className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/** Full-page state panel for auth/onboarding gates. */
export function GatePanel({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
          <span className="text-2xl font-bold text-white">A</span>
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
