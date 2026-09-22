import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// The Clerk publishable key is injected at runtime (into the process serving
// port 3000), so we must read it server-side at request time rather than
// relying on NEXT_PUBLIC_* build-time inlining. Force-dynamic ensures the
// value is resolved fresh on every request instead of being baked in at build.
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AssociateAI — AI-Powered Legal Intake & Document Generation",
  description:
    "Handle client intake and document generation faster with AI. Designed for solo practitioners and small-to-mid-size law firms.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
