import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const PLATFORM_ALIASES: Record<string, string[]> = {
  PS1: ["PS1", "PlayStation", "PlayStation 1"],
  PS2: ["PS2", "PlayStation 2"],
  PS3: ["PS3", "PlayStation 3"],
  PS4: ["PS4", "PlayStation 4"],
  PS5: ["PS5", "PlayStation 5"],
  PSP: ["PSP"],
  Vita: ["PS Vita", "Vita", "PlayStation Vita"],
  DS: ["DS", "Nintendo DS"],
  "2DS": ["2DS", "Nintendo 2DS"],
  "3DS": ["3DS", "Nintendo 3DS"],
  Wii: ["Wii"],
  WiiU: ["Wii U", "WiiU"],
  Switch: ["Switch", "Nintendo Switch"],
  Switch2: ["Switch 2", "Nintendo Switch 2"],
  N64: ["N64", "Nintendo 64"],
  GBA: ["GBA", "Game Boy Advance"],
  GBC: ["GBC", "Game Boy Color"],
  GameBoy: ["Game Boy"],
  SNES: ["SNES", "Super Nintendo", "Super Famicom / SNES"],
  NES: ["NES", "Nintendo Entertainment System", "Famicom / NES"],
  GameCube: ["GameCube", "Nintendo GameCube"],
  Dreamcast: ["Dreamcast", "Sega Dreamcast"],
  MasterSystem: ["Master System", "Sega Master System"],
  MegaDrive: ["Mega Drive", "Genesis / Mega Drive", "Sega Genesis"],
  Saturn: ["Saturn", "Sega Saturn"],
  GameGear: ["Game Gear", "Sega Game Gear"],
  Intellivision: ["Intellivision"],
  Xbox: ["Xbox"],
  Xbox360: ["Xbox 360"],
  XboxOne: ["Xbox One"],
  XboxSeries: ["Xbox Series", "Xbox Series X", "Xbox Series S"],
};

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function makeLoosePattern(value: string) {
  const words = normalizeSearch(value).split(/\s+/).filter(Boolean);
  return `%${words.join("%")}%`;
}

function platformValues(platform?: string | null) {
  if (!platform) return [];
  return PLATFORM_ALIASES[platform] ?? [platform];
}

function marketLabel(
  price: number | null,
  q1: number,
  median: number,
  q3: number
) {
  if (price === null) return "Prix à comparer";
  if (price <= q1) return "Très intéressant";
  if (price < median) return "Bon prix";
  if (price <= q3) return "Prix dans le marché";
  return "Prix élevé";
}

function confidenceLabel(confidence: number | null, sampleCount: number) {
  if (confidence === null) return "Non renseignée";
  if (sampleCount < 3) return "Faible";
  if (confidence >= 80) return "Élevée";
  if (confidence >= 50) return "Moyenne";
  return "Faible";
}

export async function searchQuotes(
  query: string,
  platform?: string | null,
  userPrice?: number | null
) {
  const cleanQuery = normalizeSearch(query);
  const loosePattern = makeLoosePattern(query);
  const platforms = platformValues(platform);

  if (!cleanQuery) return [];

  let rows: any[] = [];

  if (platforms.length > 0) {
    rows = await sql`
      SELECT
        platform,
        canonical_key,
        item_kind,
        raw_sample_count,
        sample_count,
        q1_price,
        median_price,
        q3_price,
        min_price,
        max_price,
        confidence,
        demand_confidence,
        updated_at
      FROM brain.market_quotes_product_v3
      WHERE item_kind = 'game'
        AND platform = ANY(${platforms})
        AND lower(canonical_key) = ${cleanQuery}
      ORDER BY sample_count DESC, confidence DESC NULLS LAST
      LIMIT 8
    `;

    if (rows.length === 0) {
      rows = await sql`
        SELECT
          platform,
          canonical_key,
          item_kind,
          raw_sample_count,
          sample_count,
          q1_price,
          median_price,
          q3_price,
          min_price,
          max_price,
          confidence,
          demand_confidence,
          updated_at
        FROM brain.market_quotes_product_v3
        WHERE item_kind = 'game'
          AND platform = ANY(${platforms})
          AND lower(canonical_key) LIKE ${loosePattern}
        ORDER BY
          CASE
            WHEN lower(canonical_key) LIKE ${`${cleanQuery}%`} THEN 0
            ELSE 1
          END,
          sample_count DESC,
          confidence DESC NULLS LAST
        LIMIT 8
      `;
    }
  } else {
    rows = await sql`
      SELECT
        platform,
        canonical_key,
        item_kind,
        raw_sample_count,
        sample_count,
        q1_price,
        median_price,
        q3_price,
        min_price,
        max_price,
        confidence,
        demand_confidence,
        updated_at
      FROM brain.market_quotes_product_v3
      WHERE item_kind = 'game'
        AND lower(canonical_key) LIKE ${loosePattern}
      ORDER BY
        CASE WHEN lower(canonical_key) = ${cleanQuery} THEN 0 ELSE 1 END,
        sample_count DESC,
        confidence DESC NULLS LAST
      LIMIT 8
    `;
  }

  return Promise.all(
    rows.map(async (row) => {
      const latestRows = await sql`
        SELECT
          asking_price,
          total_price,
          observed_at,
          source,
          url
        FROM brain.market_observations
        WHERE market_eligibility_v3 = 'eligible'
          AND item_kind = 'game'
          AND platform = ${row.platform}
          AND canonical_key_v3 = ${row.canonical_key}
        ORDER BY observed_at DESC
        LIMIT 1
      `;

      const latest = latestRows[0] ?? null;
      const q1 = Number(row.q1_price);
      const median = Number(row.median_price);
      const q3 = Number(row.q3_price);
      const confidence = row.confidence === null ? null : Number(row.confidence);
      const sampleCount = Number(row.sample_count ?? 0);

      return {
        platform: row.platform,
        canonicalKey: row.canonical_key,
        itemKind: row.item_kind,
        rawSampleCount: Number(row.raw_sample_count ?? 0),
        sampleCount,
        q1Price: q1,
        medianPrice: median,
        q3Price: q3,
        minPrice: Number(row.min_price),
        maxPrice: Number(row.max_price),
        confidence,
        demandConfidence:
          row.demand_confidence === null ? null : Number(row.demand_confidence),
        updatedAt: row.updated_at,
        marketAssessment: {
          label: marketLabel(userPrice ?? null, q1, median, q3),
          userPrice: userPrice ?? null,
        },
        confidenceAssessment: confidenceLabel(confidence, sampleCount),
        latestObservation: latest
          ? {
              askingPrice:
                latest.asking_price === null ? null : Number(latest.asking_price),
              totalPrice:
                latest.total_price === null ? null : Number(latest.total_price),
              observedAt: latest.observed_at,
              source: latest.source,
              url: latest.url,
            }
          : null,
      };
    })
  );
}
