import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createFirm, addFirmUser, initSchema } from "@/lib/db";
import { generateId } from "@/lib/db-client";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { firmName, practiceAreas, teamSize } = await req.json();

    if (!firmName || !firmName.trim()) {
      return NextResponse.json(
        { success: false, error: "Firm name is required" },
        { status: 400 },
      );
    }

    // Initialize schema if not already done
    await initSchema();

    // Create firm
    const firmId = generateId();
    const slug = firmName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    await createFirm(
      firmId,
      firmName.trim(),
      slug,
      practiceAreas || null,
      teamSize || null,
    );

    // Add user as firm admin
    const firmUserId = generateId();
    const userName =
      (await session).sessionClaims?.name?.toString() ?? "Unknown";
    const userEmail =
      (await session).sessionClaims?.email?.toString() ?? "unknown@email.com";

    await addFirmUser(
      firmUserId,
      firmId,
      userId,
      userEmail,
      userName,
      "admin",
    );

    return NextResponse.json({
      success: true,
      data: { firmId, slug },
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create firm",
      },
      { status: 500 },
    );
  }
}