import { NextRequest, NextResponse } from "next/server";
import { searchQuotes } from "../../../lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query =
      request.nextUrl.searchParams.get("q")?.trim() ?? "";

    const priceParam =
      request.nextUrl.searchParams.get("price");

    if (query.length < 2) {
      return NextResponse.json(
        { error: "Saisis au moins 2 caractères." },
        { status: 400 }
      );
    }

    let evaluatedPrice: number | null = null;

    if (priceParam && priceParam.trim() !== "") {
      const normalizedPrice =
        priceParam.replace(",", ".");

      const parsedPrice =
        Number(normalizedPrice);

      if (
        !Number.isFinite(parsedPrice) ||
        parsedPrice < 0
      ) {
        return NextResponse.json(
          { error: "Le prix indiqué n'est pas valide." },
          { status: 400 }
        );
      }

      evaluatedPrice = parsedPrice;
    }

    const data = await searchQuotes(
      query,
      evaluatedPrice
    );

    return NextResponse.json({
      query,
      ...data,
    });
  } catch (error) {
    console.error(
      "Cote Collection search error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de consulter le Cerveau Collection.",
      },
      { status: 500 }
    );
  }
}
