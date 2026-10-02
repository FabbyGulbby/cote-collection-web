import { NextRequest, NextResponse } from "next/server";
import { searchQuotes } from "../../../lib/search";
import {
  authenticatedRpc,
  getAuthenticatedSession,
} from "../../../lib/supabase-auth";

export const dynamic = "force-dynamic";

const PLATFORM_SUFFIXES: Array<[RegExp, string]> = [
  [/\s+playstation\s*5$/i, "PS5"],
  [/\s+ps5$/i, "PS5"],
  [/\s+playstation\s*4$/i, "PS4"],
  [/\s+ps4$/i, "PS4"],
  [/\s+playstation\s*3$/i, "PS3"],
  [/\s+ps3$/i, "PS3"],
  [/\s+playstation\s*2$/i, "PS2"],
  [/\s+ps2$/i, "PS2"],
  [/\s+playstation\s*1$/i, "PS1"],
  [/\s+ps1$/i, "PS1"],
  [/\s+psp$/i, "PSP"],
  [/\s+(?:ps\s+vita|vita)$/i, "Vita"],
  [/\s+nintendo\s+3ds$/i, "3DS"],
  [/\s+3ds$/i, "3DS"],
  [/\s+nintendo\s+ds$/i, "DS"],
  [/\s+ds$/i, "DS"],
  [/\s+wii\s*u$/i, "WiiU"],
  [/\s+wii$/i, "Wii"],
  [/\s+nintendo\s+switch$/i, "Switch"],
  [/\s+switch$/i, "Switch"],
  [/\s+nintendo\s+64$/i, "N64"],
  [/\s+n64$/i, "N64"],
  [/\s+(?:super\s+nintendo|snes)$/i, "SNES"],
  [/\s+(?:nintendo\s+entertainment\s+system|nes)$/i, "NES"],
  [/\s+(?:nintendo\s+)?gamecube$/i, "GameCube"],
  [/\s+xbox\s*360$/i, "Xbox360"],
  [/\s+xbox\s+one$/i, "XboxOne"],
];

function splitQuery(rawQuery: string) {
  for (const [pattern, platform] of PLATFORM_SUFFIXES) {
    if (pattern.test(rawQuery)) {
      return {
        title: rawQuery.replace(pattern, "").trim(),
        platform,
      };
    }
  }

  return {
    title: rawQuery.trim(),
    platform: null as string | null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    }

    const profile = await authenticatedRpc<any>(
      "cote_current_profile_v1",
      {},
      session.accessToken
    );

    if (!profile.ok) {
      return NextResponse.json({ error: profile.error }, { status: profile.status || 500 });
    }

    if (!profile.data?.isActive) {
      return NextResponse.json({ error: "Compte en attente d’activation." }, { status: 403 });
    }

    const rawQuery = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const explicitPlatform =
      request.nextUrl.searchParams.get("platform")?.trim() || null;
    const priceParam = request.nextUrl.searchParams.get("price");

    if (rawQuery.length < 2) {
      return NextResponse.json(
        { error: "Saisis au moins 2 caractères." },
        { status: 400 }
      );
    }

    const parsed = splitQuery(rawQuery);
    const query = parsed.title;
    const platform = explicitPlatform ?? parsed.platform;

    if (query.length < 2) {
      return NextResponse.json(
        { error: "Le titre du jeu est trop court." },
        { status: 400 }
      );
    }

    let evaluatedPrice: number | null = null;
    if (priceParam && priceParam.trim() !== "") {
      const parsedPrice = Number(priceParam.replace(",", "."));
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json(
          { error: "Le prix indiqué n'est pas valide." },
          { status: 400 }
        );
      }
      evaluatedPrice = parsedPrice;
    }

    const results = await searchQuotes(query, platform, evaluatedPrice);
    const result = results[0] ?? null;

    let ownership: any = null;
    if (result) {
      const owned = await authenticatedRpc<any>(
        "cote_owned_lookup_v1",
        {
          p_title: result.canonicalKey,
          p_platform: result.platform,
        },
        session.accessToken
      );

      ownership = owned.ok
        ? { available: true, ...(owned.data ?? { owned: false }) }
        : { available: false, owned: null };
    }

    return NextResponse.json({
      query,
      platform,
      found: result !== null,
      result: result
        ? {
            title: result.canonicalKey,
            platform: result.platform,
            canonicalKey: result.canonicalKey,
            evaluatedPrice,
            marketReading: result.marketAssessment.label,
            quote: {
              q1: result.q1Price,
              median: result.medianPrice,
              q3: result.q3Price,
              observations: result.sampleCount,
              rawObservations: result.rawSampleCount,
              confidence: result.confidence,
              confidenceLabel: result.confidenceAssessment,
            },
            ownership,
            latestObservation: result.latestObservation,
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
    console.error("Cote Collection search error:", error);
    return NextResponse.json(
      { error: "Impossible de consulter le Cerveau Collection." },
      { status: 500 }
    );
  }
}
