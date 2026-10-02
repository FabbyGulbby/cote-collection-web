export type ImportedCollectionItem = {
  name: string;
  platform: string;
  region: string | null;
  completeness: string | null;
  edition: string | null;
};

function parseRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

export function parseMyGameDbCsv(text: string): ImportedCollectionItem[] {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("Le CSV ne contient aucune ligne de collection.");

  const headers = rows[0].map(normalizeHeader);
  const indexOf = (name: string) => headers.indexOf(name.toLowerCase());

  const nameIndex = indexOf("Name");
  const platformIndex = indexOf("Platform");
  const regionIndex = indexOf("Region");
  const contentIndex = indexOf("Content");
  const editionIndex = indexOf("Edition");

  if (nameIndex < 0 || platformIndex < 0) {
    throw new Error("Format MyGameDB non reconnu : colonnes Name et Platform requises.");
  }

  const items = rows
    .slice(1)
    .map((row) => ({
      name: (row[nameIndex] ?? "").trim(),
      platform: (row[platformIndex] ?? "").trim(),
      region: regionIndex >= 0 ? (row[regionIndex] ?? "").trim() || null : null,
      completeness:
        contentIndex >= 0 ? (row[contentIndex] ?? "").trim() || null : null,
      edition: editionIndex >= 0 ? (row[editionIndex] ?? "").trim() || null : null,
    }))
    .filter((item) => item.name && item.platform);

  if (items.length === 0) throw new Error("Aucun jeu exploitable trouvé dans ce CSV.");
  if (items.length > 5000) throw new Error("Le CSV dépasse la limite de 5 000 jeux.");

  return items;
}
