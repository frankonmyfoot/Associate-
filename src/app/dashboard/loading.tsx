export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="mt-2 h-4 w-64 rounded bg-muted" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border p-5">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-3 h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="mt-3 flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-36 rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border">
            <div className="border-b px-5 py-3">
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="h-3 w-48 rounded bg-muted" />
                    <div className="h-2 w-24 rounded bg-muted" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}