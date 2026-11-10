import { parseSwimTime, type Centiseconds } from "./time";

export interface RankingRow {
  rank: number;
  name: string;
  membership: string | null;
  club: string;
  yearOfBirth: string | null;
  meet: string | null;
  venue: string | null;
  level: string | null;
  dateText: string | null;
  time: Centiseconds | null;
  points: string | null;
}

export interface RankingTable {
  title: string | null;
  rows: RankingRow[];
}

export function parseRankingPage(html: string): RankingTable {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, " ").trim() ?? null;
  const table = html.match(/<table[^>]*id=["']rankTable["'][\s\S]*?<\/table>/i)?.[0] ?? "";
  const rawRows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const parsed = rawRows.map(cellsOf).filter((cells) => cells.length > 0);
  const headerIndex = parsed.findIndex((cells) => cells.some((cell) => cell.text.toLowerCase() === "rank"));
  if (headerIndex < 0) return { title, rows: [] };

  const header = parsed[headerIndex].map((cell) => cell.text.toLowerCase());
  const at = (name: string) => header.indexOf(name);
  const rows: RankingRow[] = [];
  let previousRank = 0;
  for (const cells of parsed.slice(headerIndex + 1)) {
    const rankText = cells[at("rank")]?.text ?? "";
    const parsedRank = Number(rankText);
    const rank = rankText && Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : previousRank;
    if (rank <= 0) continue;
    previousRank = rank;
    const nameCell = cells[at("name")];
    rows.push({
      rank,
      name: nameCell?.text ?? "",
      membership: nameCell?.html.match(/tiref=(\d+)/i)?.[1] ?? null,
      club: cells[at("ranked club")]?.text ?? cells[at("club")]?.text ?? "",
      yearOfBirth: cells[at("yob")]?.text ?? null,
      meet: cells[at("meet name")]?.text ?? null,
      venue: cells[at("venue")]?.text ?? null,
      level: cells[at("level")]?.text ?? null,
      dateText: cells[at("date")]?.text ?? null,
      time: parseSwimTime(cells[at("time")]?.text ?? ""),
      points: cells[at("fina")]?.text ?? null,
    });
  }
  return { title, rows };
}

export function findRankingRow(
  table: RankingTable,
  membership: string,
  name: string,
): RankingRow | null {
  const byNumber = table.rows.find((row) => row.membership === membership);
  if (byNumber) return byNumber;
  const target = name.toLowerCase().replace(/[^a-z]/g, "");
  return table.rows.find((row) => row.name.toLowerCase().replace(/[^a-z]/g, "") === target) ?? null;
}

function cellsOf(rowHtml: string): { text: string; html: string }[] {
  return [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => ({
    html: match[1],
    text: decode(match[1].replace(/<[^>]+>/g, " ")).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(),
  }));
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}
