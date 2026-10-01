import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const PLATFORM_ALIASES: Record<string, string[]> = {
  PS1: ["PS1", "PlayStation", "PlayStation 1"],
  PS2: ["PS2", "PlayStation 2"],
  PS3: ["PS3", "PlayStation 3"],
  PS4: ["PS4", "PlayStation 4"],
  PS5: ["PS5", "PlayStation 5"],
  PSP: ["PSP"],
  Vita: ["Vita", "PS Vita", "PlayStation Vita"],
  DS: ["DS", "Nintendo DS"],
  "3DS": ["3DS", "Nintendo 3DS"],
  Wii: ["Wii"],
  WiiU: ["Wii U", "WiiU"],
  Switch: ["Switch", "Nintendo Switch"],
  N64: ["N64", "Nintendo 64"],
  SNES: ["SNES", "Super Nintendo", "Super Famicom / SNES"],
  NES: ["NES", "Nintendo Entertainment System", "Famicom / NES"],
  GameCube: ["GameCube", "Nintendo GameCube"],
  Xbox360: ["Xbox 360"],
  XboxOne: ["Xbox One"],
};

type Ownership = {
  owned: boolean;
  displayName?: string;
  platform?: string;
  completeness?: string;
  edition?: string;
  region?: string;
};

type CollectionFit = {
  score?: number;
  label?: string;
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

async function supabaseRpc<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T | null> {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!rawUrl || !key) {
    console.error("Configuration Supabase manquante.");
    return null;
  }

  // Accepte aussi bien :
  // https://xxxxx.supabase.co
  // que https://xxxxx.supabase.co/rest/v1
  const supabaseBaseUrl = rawUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");

  const rpcUrl = `${supabaseBaseUrl}/rest/v1/rpc/${functionName}`;

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `RPC Supabase ${functionName} : ${response.status} ${await response.text()}`
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`Erreur RPC Supabase ${functionName}`, error);
    return null;
  }
}

export async function searchQuotes(
  query: string,
  platform?: string | null,
  userPrice?: number | null
) {
  const cleanQuery = normalizeSearch(query);
  const loosePattern = makeLoosePattern(query);
  const platforms = platformValues(platform);

  if (!cleanQuery) {
    return [];
  }

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

      const [ownership, collectionFit] = await Promise.all([
        supabaseRpc<Ownership>("cote_collection_owned_lookup_v1", {
          p_title: row.canonical_key,
          p_platform: row.platform,
        }),
        supabaseRpc<CollectionFit>("vinted_collection_fit_v1", {
          p_title: row.canonical_key,
          p_platform: row.platform,
        }),
      ]);

      const latest = latestRows[0] ?? null;
      const q1 = Number(row.q1_price);
      const median = Number(row.median_price);
      const q3 = Number(row.q3_price);
      const confidence =
        row.confidence === null ? null : Number(row.confidence);
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
          row.demand_confidence === null
            ? null
            : Number(row.demand_confidence),
        updatedAt: row.updated_at,

        marketAssessment: {
          label: marketLabel(userPrice ?? null, q1, median, q3),
          userPrice: userPrice ?? null,
        },

        confidenceAssessment: confidenceLabel(confidence, sampleCount),

        collectionInterest: collectionFit
          ? {
              available: true,
              score:
                typeof collectionFit.score === "number"
                  ? collectionFit.score
                  : null,
              label: collectionFit.label ?? "Non renseigné",
              reason:
                typeof collectionFit.score === "number"
                  ? `Score collection existant : ${collectionFit.score}/100`
                  : "Évaluation issue du système collection existant.",
            }
          : {
              available: false,
              score: null,
              label: "Indisponible",
              reason: "La source collection n’a pas répondu.",
            },

        ownership: ownership
          ? {
              available: true,
              owned: ownership.owned,
              displayName: ownership.displayName ?? null,
              platform: ownership.platform ?? null,
              completeness: ownership.completeness ?? null,
              edition: ownership.edition ?? null,
              region: ownership.region ?? null,
            }
          : {
              available: false,
              owned: null,
              displayName: null,
              platform: null,
              completeness: null,
              edition: null,
              region: null,
            },

        latestObservation: latest
          ? {
              askingPrice:
                latest.asking_price === null
                  ? null
                  : Number(latest.asking_price),
              totalPrice:
                latest.total_price === null
                  ? null
                  : Number(latest.total_price),
              observedAt: latest.observed_at,
              source: latest.source,
              url: latest.url,
            }
          : null,
      };
    })
  );
}
