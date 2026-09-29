import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function searchQuotes(query: string) {
  const clean = query.trim();
  const parts = clean.split(/\s+/);

  const platformAliases: Record<string, string> = {
    ps1: 'PS1',
    ps2: 'PS2',
    ps3: 'PS3',
    ps4: 'PS4',
    ps5: 'PS5',
    psp: 'PSP',
    vita: 'PS Vita',
    ds: 'DS',
    '3ds': '3DS',
    wii: 'Wii',
    wiiu: 'Wii U',
    switch: 'Switch',
    n64: 'N64',
    snes: 'SNES',
    nes: 'NES',
    gamecube: 'GameCube',
    gc: 'GameCube',
    x360: 'Xbox 360',
    xbox360: 'Xbox 360',
    xone: 'Xbox One',
  };

  let platform: string | null = null;
  const titleParts: string[] = [];

  for (const part of parts) {
    const alias = platformAliases[part.toLowerCase()];

    if (alias) {
      platform = alias;
    } else {
      titleParts.push(part);
    }
  }

  const title = titleParts.join(' ').trim();
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
    return [];
  }

  const results = [];

  for (const quote of quotes) {
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

    const obs = observations[0];

    results.push({
      platform: quote.platform,
      title: obs?.title ?? quote.canonical_key,
      canonicalKey: quote.canonical_key,

      askingPrice:
        obs?.asking_price == null
          ? null
          : Number(obs.asking_price),

      totalPrice:
        obs?.total_price == null
          ? null
          : Number(obs.total_price),

      median:
        quote.median_price == null
          ? null
          : Number(quote.median_price),

      q1:
        quote.q1_price == null
          ? null
          : Number(quote.q1_price),

      q3:
        quote.q3_price == null
          ? null
          : Number(quote.q3_price),

      observations: Number(quote.sample_count ?? 0),

      rawObservations: Number(
        quote.raw_sample_count ?? 0
      ),

      confidence: Number(
        quote.confidence ?? 0
      ),

      demandConfidence: Number(
        quote.demand_confidence ?? 0
      ),

      windowDays: Number(
        quote.window_days ?? 0
      ),

      updatedAt: quote.updated_at,
    });
  }

  return results;
}
