import { NextRequest, NextResponse } from "next/server";
import { searchQuotes } from "../../../lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query =
      request.nextUrl.searchParams.get("q")?.trim() ?? "";

    const platform =
      request.nextUrl.searchParams.get("platform")?.trim() || null;

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

      const parsedPrice = Number(normalizedPrice);

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

    const results = await searchQuotes(
      query,
      platform,
      evaluatedPrice
    );

    const result = results[0] ?? null;

    return NextResponse.json({
      query,
      found: result !== null,
      result: result
        ? {
            title: result.canonicalKey,
            platform: result.platform,
            canonicalKey: result.canonicalKey,

            evaluatedPrice,

            marketReading:
              result.marketAssessment.label,

            quote: {
              q1: result.q1Price,
              median: result.medianPrice,
              q3: result.q3Price,
              observations: result.sampleCount,
              rawObservations:
                result.rawSampleCount,
              confidence: result.confidence,
              confidenceLabel:
                result.confidenceAssessment,
            },

            collectionInterest:
              result.collectionInterest,

            ownership:
              result.ownership,

            latestObservation:
              result.latestObservation,
          }
        : null,

      candidates: results.slice(1).map((item) => ({
        platform: item.platform,
        canonicalKey: item.canonicalKey,
        median: item.medianPrice,
        observations: item.sampleCount,
      })),
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
