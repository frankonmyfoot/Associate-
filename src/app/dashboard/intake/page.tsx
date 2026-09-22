import Link from "next/link";

export default function IntakePage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Intake</h1>
          <p className="mt-1 text-muted-foreground">
            Manage intake forms and view client submissions.
          </p>
        </div>
        <Link
          href="/dashboard/intake/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New Intake Form
        </Link>
      </div>

      {/* Form list will be rendered client-side */}
      <IntakeFormList />
    </div>
  );
}

// Client component to fetch and render forms
import { IntakeForm } from "@/types";

async function IntakeFormList() {
  let forms: IntakeForm[] = [];

  try {
    const { host, protocol } = getBaseUrl();
    const res = await fetch(`${protocol}//${host}/api/intake/forms`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      forms = json.data ?? [];
    }
  } catch {
    // API not available during static generation
  }

  if (forms.length === 0) {
    return (
      <div className="mt-8 rounded-xl border p-12 text-center text-muted-foreground">
        <svg
          className="mx-auto h-12 w-12 text-muted-foreground/50"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold">No intake forms yet</h3>
        <p className="mt-2 text-sm">
          Create your first intake form to start collecting client information
          seamlessly.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {forms.map((form) => (
        <Link
          key={form.id}
          href={`/dashboard/intake/${form.id}`}
          className="rounded-xl border p-5 hover:border-primary-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between">
            <h3 className="font-semibold">{form.title}</h3>
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                form.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {form.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {form.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {form.description}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {Array.isArray(form.fields) ? form.fields.length : 0} field(s)
          </p>
        </Link>
      ))}
    </div>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return { host: window.location.host, protocol: window.location.protocol };
  }
  return { host: "localhost:3000", protocol: "http:" };
}