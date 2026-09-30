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
  "wiiu": "Wii U",
  "wii-u": "Wii U",
  switch: "Switch",
  n64: "N64",
  snes: "SNES",
  nes: "NES",
  gamecube: "GameCube",
  gc: "GameCube",
  x360: "Xbox 360",
  xbox360: "Xbox 360",
  "xbox-360": "Xbox 360",
  xone: "Xbox One",
  xboxone: "Xbox One",
  "xbox-one": "Xbox One",
};

function confidenceLabel(value: number, observations: number) {
  if (observations <= 1) return "Très faible";
  if (value >= 85 && observations >= 10) return "Très forte";
  if (value >= 65 && observations >= 5) return "Bonne";
  if (value >= 40) return "Moyenne";
  return "Faible";
}

function marketLabel(
  price: number | null,
  q1: number | null,
  median: number | null,
  q3: number | null
) {
  if (price === null || median === null) {
    return "Prix à renseigner";
  }

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

function normalizeSearch(query: string) {
  let clean = query
    .trim()
    .replace(/\s+/g, " ");

  let platform: string | null = null;

  const multiWordPlatforms: Array<[RegExp, string]> = [
    [/\bxbox\s*360\b/i, "Xbox 360"],
    [/\bxbox\s*one\b/i, "Xbox One"],
    [/\bwii\s*u\b/i, "Wii U"],
    [/\bps\s*vita\b/i, "PS Vita"],
    [/\bgame\s*cube\b/i, "GameCube"],
  ];

  for (const [regex, value] of multiWordPlatforms) {
    if (regex.test(clean)) {
      platform = value;
      clean = clean.replace(regex, " ");
      break;
    }
  }

  const parts = clean
    .split(/\s+/)
    .filter(Boolean);

  const titleParts: string[] = [];

  for (const part of parts) {
    const alias =
      PLATFORM_ALIASES[part.toLowerCase()];

    if (!platform && alias) {
      platform = alias;
    } else if (alias && alias === platform) {
      continue;
    } else {
      titleParts.push(part);
    }
  }

  return {
    platform,
    title: titleParts.join(" ").trim(),
  };
}

function makeLoosePattern(title: string) {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return `%${words.join("%")}%`;
}

export async function searchQuotes(
  query: string,
  evaluatedPrice?: number | null
) {
  const { platform, title } =
    normalizeSearch(query);

  if (!title) {
    return {
      found: false,
      result: null,
      candidates: [],
    };
  }

  const exactPattern = `%${title}%`;
  const loosePattern = makeLoosePattern(title);

  let quotes = platform
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
          AND canonical_key ILIKE ${exactPattern}
        ORDER BY
          sample_count DESC,
          confidence DESC
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
        WHERE canonical_key ILIKE ${exactPattern}
        ORDER BY
          sample_count DESC,
          confidence DESC
        LIMIT 8
      `;

  if (!quotes.length && loosePattern !== exactPattern) {
    quotes = platform
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
            AND canonical_key ILIKE ${loosePattern}
          ORDER BY
            sample_count DESC,
            confidence DESC
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
          WHERE canonical_key ILIKE ${loosePattern}
          ORDER BY
            sample_count DESC,
            confidence DESC
          LIMIT 8
        `;
  }

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

  const sampleCount =
    Number(quote.sample_count ?? 0);

  const confidence =
    Number(quote.confidence ?? 0);

  const priceToEvaluate =
    evaluatedPrice != null &&
    Number.isFinite(evaluatedPrice) &&
    evaluatedPrice >= 0
      ? evaluatedPrice
      : null;

  const candidates = quotes
    .slice(1)
    .map((candidate) => ({
      platform: candidate.platform,
      canonicalKey: candidate.canonical_key,
      median:
        candidate.median_price == null
          ? null
          : Number(candidate.median_price),
      observations:
        Number(candidate.sample_count ?? 0),
    }));

  return {
    found: true,

    result: {
      platform: quote.platform,
      title:
        observation?.title ??
        quote.canonical_key,
      canonicalKey: quote.canonical_key,

      evaluatedPrice: priceToEvaluate,

      marketReading: marketLabel(
        priceToEvaluate,
        q1,
        median,
        q3
      ),

      latestObservation: {
        askingPrice,
        totalPrice,
        observedAt:
          observation?.observed_at ?? null,
      },

      quote: {
        q1,
        median,
        q3,

        observations: sampleCount,

        rawObservations:
          Number(quote.raw_sample_count ?? 0),

        confidence,

        confidenceLabel:
          confidenceLabel(
            confidence,
            sampleCount
          ),

        demandConfidence:
          Number(
            quote.demand_confidence ?? 0
          ),

        windowDays:
          Number(quote.window_days ?? 0),

        updatedAt: quote.updated_at,
      },

      collectionInterest: {
        label: "À connecter",
        reason:
          "L’intérêt collection sera ajouté dès qu’une source fiable du Cerveau sera identifiée.",
      },
    },

    candidates,
  };
}
