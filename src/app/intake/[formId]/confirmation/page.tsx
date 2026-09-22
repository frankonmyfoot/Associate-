import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="h-7 w-7 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold">Submission Received</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you for your submission. The law firm will review your
          information and reach out to you shortly.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          This is an automated confirmation. Please do not reply to this page.
        </p>
      </div>
    </div>
  );
}