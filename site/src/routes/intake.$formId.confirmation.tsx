import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/intake/$formId/confirmation")({
  component: ConfirmationPage,
});

function ConfirmationPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
        <span className="text-2xl font-bold text-white">A</span>
      </div>
      <h1 className="text-2xl font-bold">Intake received</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Thank you — your submission has been received and will be reviewed by
        the firm. If they need anything else, they'll contact you using the
        details you provided.
      </p>
    </div>
  );
}
