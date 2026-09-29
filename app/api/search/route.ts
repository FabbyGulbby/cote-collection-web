import { NextRequest, NextResponse } from "next/server";
import { searchQuotes } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json(
        { error: "Saisis au moins 2 caractères." },
        { status: 400 }
      );
    }

    const results = await searchQuotes(query);

    return NextResponse.json({
      query,
      results,
    });
  } catch (error) {
    console.error("Cote Collection search error:", error);

    return NextResponse.json(
      { error: "Impossible de consulter le Cerveau Collection." },
      { status: 500 }
    );
  }
}
