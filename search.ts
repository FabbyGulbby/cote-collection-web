export const PLATFORM_ALIASES: Array<[RegExp, string]> = [
  [/\bps5\b|\bplaystation 5\b/i, 'PS5'],
  [/\bps4\b|\bplaystation 4\b/i, 'PS4'],
  [/\bps3\b|\bplaystation 3\b/i, 'PS3'],
  [/\bps2\b|\bplaystation 2\b/i, 'PS2'],
  [/\bps1\b|\bplaystation 1\b|\bpsx\b/i, 'PS1'],
  [/\bxbox 360\b|\bx360\b/i, 'Xbox 360'],
  [/\bxbox one\b|\bxone\b/i, 'Xbox One'],
  [/\bswitch\b|\bnintendo switch\b/i, 'Switch'],
  [/\bwii u\b|\bwiiu\b/i, 'Wii U'],
  [/\bwii\b/i, 'Wii'],
  [/\bgamecube\b|\bgc\b/i, 'GameCube'],
  [/\bn64\b|\bnintendo 64\b/i, 'N64'],
  [/\bsnes\b|\bsuper nintendo\b/i, 'SNES'],
  [/\bnes\b/i, 'NES'],
  [/\b3ds\b/i, '3DS'],
  [/\bds\b/i, 'DS'],
  [/\bps vita\b|\bvita\b/i, 'PS Vita'],
  [/\bpsp\b/i, 'PSP']
];

export function parseSearch(input: string) {
  const raw = input.trim().replace(/\s+/g, ' ');
  let title = raw;
  let platform: string | null = null;
  for (const [rx, canonical] of PLATFORM_ALIASES) {
    if (rx.test(title)) {
      platform = canonical;
      title = title.replace(rx, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }
  const tokens = title.toLowerCase().replace(/[^a-z0-9à-ÿ]+/gi, ' ').trim().split(/\s+/).filter(Boolean);
  return { raw, title, platform, tokens };
}

export function marketLabel(price: number | null, q1: number | null, median: number | null, q3: number | null) {
  if (price == null || median == null) return null;
  if (q1 != null && price < q1 * 0.85) return 'Très intéressant';
  if (q1 != null && price <= q1) return 'Bon prix';
  if (q3 != null && price <= q3) return 'Prix normal';
  return 'Prix élevé';
}

export function confidenceLabel(value: number) {
  if (value >= 85) return 'Très forte';
  if (value >= 65) return 'Forte';
  if (value >= 45) return 'Moyenne';
  if (value >= 25) return 'Faible';
  return 'Très faible';
}
