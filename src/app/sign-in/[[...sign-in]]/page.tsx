import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-xl font-bold text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold">Sign in to AssociateAI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back to your firm dashboard.
          </p>
        </div>
        <SignIn
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border rounded-xl w-full",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "border text-sm font-medium",
              formButtonPrimary:
                "bg-primary-600 hover:bg-primary-700 text-sm font-medium",
            },
          }}
        />
      </div>
    </div>
  );
}