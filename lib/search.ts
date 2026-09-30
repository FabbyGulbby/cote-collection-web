import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const PLATFORM_ALIASES: Record<string, string> = {
  ps1: "PS1",
  ps2: "PS2",
  ps3: "PS3",
  ps4: "PS4",
  ps5: "PS5",
  psp: "PSP",
  vita: "PS Vita",
  ds: "DS",
  "3ds": "3DS",
  wii: "Wii",
  wiiu: "Wii U",
  switch: "Switch",
  n64: "N64",
  snes: "SNES",
  nes: "NES",
  gamecube: "GameCube",
  gc: "GameCube",
  x360: "Xbox 360",
  xbox360: "Xbox 360",
  xone: "Xbox One",
};

function confidenceLabel(value: number) {
  if (value >= 85) return "Très forte";
  if (value >= 65) return "Bonne";
  if (value >= 40) return "Moyenne";
  return "Faible";
}

function marketLabel(
  price: number | null,
  q1: number | null,
  median: number | null,
  q3: number | null
) {
  if (price === null || median === null) return "Données insuffisantes";

  if (q1 !== null && price < q1 * 0.85) {
    return "Très intéressant";
  }

  if (q1 !== null && price <= q1) {
    return "Bon prix";
  }

  if (q3 !== null && price <= q3) {
    return "Prix normal";
  }

  return "Prix élevé";
}

export async function searchQuotes(query: string) {
  const clean = query.trim();
  const parts = clean.split(/\s+/);

  let platform: string | null = null;
  const titleParts: string[] = [];

  for (const part of parts) {
    const alias = PLATFORM_ALIASES[part.toLowerCase()];

    if (alias) {
      platform = alias;
    } else {
      titleParts.push(part);
    }
  }

  const title = titleParts.join(" ").trim();

  if (!title) {
    return {
      found: false,
      result: null,
      candidates: [],
    };
  }

  const pattern = `%${title}%`;

  const quotes = platform
    ? await sql`
        SELECT
          platform,
          canonical_key,
          q1_price,
          median_price,
          q3_price,
          raw_sample_count,
          sample_count,
          confidence,
          demand_confidence,
          window_days,
          updated_at
        FROM brain.market_quotes_product_v3
        WHERE platform = ${platform}
          AND canonical_key ILIKE ${pattern}
        ORDER BY sample_count DESC, confidence DESC
        LIMIT 8
      `
    : await sql`
        SELECT
          platform,
          canonical_key,
          q1_price,
          median_price,
          q3_price,
          raw_sample_count,
          sample_count,
          confidence,
          demand_confidence,
          window_days,
          updated_at
        FROM brain.market_quotes_product_v3
        WHERE canonical_key ILIKE ${pattern}
        ORDER BY sample_count DESC, confidence DESC
        LIMIT 8
      `;

  if (!quotes.length) {
    return {
      found: false,
      result: null,
      candidates: [],
    };
  }

  const quote = quotes[0];

  const observations = await sql`
    SELECT
      asking_price,
      total_price,
      title,
      observed_at
    FROM brain.market_observations
    WHERE platform = ${quote.platform}
      AND canonical_key_v3 = ${quote.canonical_key}
      AND market_eligibility_v3 = 'eligible'
    ORDER BY observed_at DESC
    LIMIT 1
  `;

  const observation = observations[0];

  const askingPrice =
    observation?.asking_price == null
      ? null
      : Number(observation.asking_price);

  const totalPrice =
    observation?.total_price == null
      ? null
      : Number(observation.total_price);

  const q1 =
    quote.q1_price == null
      ? null
      : Number(quote.q1_price);

  const median =
    quote.median_price == null
      ? null
      : Number(quote.median_price);

  const q3 =
    quote.q3_price == null
      ? null
      : Number(quote.q3_price);

  const confidence = Number(quote.confidence ?? 0);

  const candidates = quotes.slice(1).map((candidate) => ({
    platform: candidate.platform,
    canonicalKey: candidate.canonical_key,
    median:
      candidate.median_price == null
        ? null
        : Number(candidate.median_price),
    observations: Number(candidate.sample_count ?? 0),
  }));

  return {
    found: true,

    result: {
      platform: quote.platform,
      title: observation?.title ?? quote.canonical_key,
      canonicalKey: quote.canonical_key,

      askingPrice,
      totalPrice,

      marketReading: marketLabel(
        totalPrice,
        q1,
        median,
        q3
      ),

      quote: {
        q1,
        median,
        q3,

        observations: Number(
          quote.sample_count ?? 0
        ),

        rawObservations: Number(
          quote.raw_sample_count ?? 0
        ),

        confidence,
        confidenceLabel: confidenceLabel(confidence),

        demandConfidence: Number(
          quote.demand_confidence ?? 0
        ),

        windowDays: Number(
          quote.window_days ?? 0
        ),

        updatedAt: quote.updated_at,
      },

      collectionInterest: {
        label: "À connecter",
        reason:
          "Le score d’intérêt pour ta collection n’est pas encore relié à une source suffisamment fiable.",
      },
    },

    candidates,
  };
}
