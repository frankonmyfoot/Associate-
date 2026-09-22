import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { execute, query } from "@/lib/db-client";
import { generateDocument } from "@/lib/ai";

// POST /api/documents/generate — Generate a document using AI
export async function POST(req: Request) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { documentType, caseDetails } = body;

    if (!documentType) {
      return NextResponse.json({ success: false, error: "Document type is required" }, { status: 400 });
    }

    if (!caseDetails || Object.keys(caseDetails).length === 0) {
      return NextResponse.json({ success: false, error: "Case details are required" }, { status: 400 });
    }

    const result = await generateDocument({
      documentType,
      caseDetails,
    });

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        model: result.model,
      },
    });
  } catch (error) {
    console.error("Document generation error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}