"use client";

import { useRouter } from "next/navigation";

export default function SubmissionActions({
  submissionId,
  currentStatus,
}: {
  submissionId: string;
  currentStatus: string;
}) {
  const router = useRouter();

  const updateStatus = async (status: string) => {
    await fetch(`/api/intake/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  };

  return (
    <div className="mt-6 flex items-center gap-3">
      {currentStatus === "pending" && (
        <button
          onClick={() => updateStatus("reviewed")}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Mark as Reviewed
        </button>
      )}
      {currentStatus !== "archived" && (
        <button
          onClick={() => updateStatus("archived")}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Archive
        </button>
      )}
      {currentStatus === "archived" && (
        <button
          onClick={() => updateStatus("pending")}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Restore
        </button>
      )}
    </div>
  );
}