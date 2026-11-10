import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/lib/build-view";
import { compareStandards, pbLine } from "@/lib/compare";
import { convertCourse } from "@/lib/convert";
import { parseSwimTime, formatSwimTime } from "@/lib/time";
import { parseBiogs } from "@/lib/parse-biogs";
import { findRankingRow, parseRankingPage } from "@/lib/parse-rankings";
import { rankingListUrl } from "@/lib/ranking-query";
import { assembleGalaSwims, parseResultPage, parseResultsDocument } from "@/lib/parse-sportsystems";
import { isSwimManagerLogin } from "@/lib/swimmanager";
import { qualifyingWindowLine } from "@/lib/windows";
import { chooseResultsSource, findResultsIndex } from "@/lib/meet-source";
import { assessResultsHtml, httpUrl } from "@/lib/validate-results";

function fixture(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("times and conversions", () => {
  it("parses and formats hundredths exactly", () => {
    expect(parseSwimTime("35.89")).toBe(3589);
    expect(parseSwimTime("2:09.05")).toBe(12905);
    expect(parseSwimTime("1:21.00")).toBe(8100);
    expect(parseSwimTime(".")).toBeNull();
    expect(formatSwimTime(3589)).toBe("35.89");
    expect(formatSwimTime(12905)).toBe("2:09.05");
  });

  it("uses the published 100m backstroke example", () => {
    const event = { distance: 100, stroke: "backstroke" as const };
    expect(convertCourse(6350, "LC", "SC", event)).toBe(6220);
    expect(formatSwimTime(convertCourse(3589, "SC", "LC", { distance: 50, stroke: "freestyle" }) ?? 0)).toBe("36.50");
  });

  it("leaves 100m IM unconverted", () => {
    expect(convertCourse(9000, "SC", "LC", { distance: 100, stroke: "im" })).toBeNull();
  });
});

describe("biography and results fixtures", () => {
  const profile = parseBiogs(fixture("fixtures/biogs-details.html"));

  it("reads Mia's biography and bests", () => {
    expect(profile.name).toBe("Mia Clarke");
    expect(profile.membershipNumber).toBe("1820449");
    expect(profile.yearOfBirth).toBe(2016);
    expect(profile.gender).toBe("female");
    expect(profile.club).toContain("Warrington");
    const free = profile.bests.find((best) => best.event.distance === 50 && best.event.stroke === "freestyle");
    expect(free?.shortCoursePb).toBe(3589);
    expect(free?.longCoursePb).toBe(3757);
    const im = profile.bests.find((best) => best.event.distance === 100 && best.event.stroke === "im");
    expect(im?.shortCoursePb).not.toBeNull();
    expect(im?.longCoursePb).toBeNull();
  });

  it("follows the SportSystems frameset and Mia's 50 free", () => {
    const index = parseResultsDocument(fixture("fixtures/sportsystems/index.htm"));
    expect(index.kind).toBe("frameset");
    const before = parseResultsDocument(fixture("fixtures/sportsystems/before.htm"));
    expect(before.kind).toBe("meet");
    if (before.kind !== "meet") return;
    const event = before.meet.events.find((item) => item.label.includes("50m Freestyle") && item.label.includes("Female"));
    expect(event?.resultHref).toMatch(/RG1H103/i);
    expect(event?.dateText).toBe("27/09/26");

    const result = parseResultPage(fixture("fixtures/sportsystems/RG1H103.HTM"));
    const mia = result.rows.find((row) => row.name === "Mia Clarke");
    expect(result.event).toEqual({ distance: 50, stroke: "freestyle" });
    expect(mia?.time).toBe(3589);
    expect(mia?.place).toBe(1);
    expect(mia?.ageGroup).toBe("10 yrs");

    const swims = assembleGalaSwims({
      meet: before.meet,
      name: "Mia Clarke",
      clubMatch: "Warrington",
      pages: [
        { href: "RG1H103.HTM", html: fixture("fixtures/sportsystems/RG1H103.HTM"), kind: "result" },
        { href: "SG1H103.HTM", html: fixture("fixtures/sportsystems/SG1H103.HTM"), kind: "start" },
      ],
    });
    expect(swims).toHaveLength(1);
    expect(swims[0].entryTime).toBe(3700);
    expect(swims[0].time).toBe(3589);
  });

  it("builds the gala card against county and regional standards", () => {
    const before = parseResultsDocument(fixture("fixtures/sportsystems/before.htm"));
    if (before.kind !== "meet") throw new Error("expected a meet");
    const swims = assembleGalaSwims({
      meet: before.meet,
      name: "Mia Clarke",
      clubMatch: "Warrington",
      pages: [
        { href: "RG1H103.HTM", html: fixture("fixtures/sportsystems/RG1H103.HTM"), kind: "result" },
        { href: "SG1H103.HTM", html: fixture("fixtures/sportsystems/SG1H103.HTM"), kind: "start" },
      ],
    });
    const model = buildDashboard({
      profile,
      swims,
      meetName: before.meet.name,
      meetCourse: "SC",
      rankingsAgeAt: "31/12/2026",
      fallbackName: "Mia Clarke",
      membership: "1820449",
      warnings: [],
      sources: [],
      fetchedAt: "2026-11-10T12:00:00.000Z",
    });
    const card = model.galaCards[0];
    expect(card.headline).toBe("35.89");
    expect(card.pbLine).toContain("published short course PB is this race");
    expect(card.entry).toContain("37.00");
    expect(card.summary).toBe("Achieved county by 0.61s; needs 3.91s more for regional.");
    expect(card.windowLine).toBe("In the county and regional qualifying windows.");
    expect(card.longPb).toBe("37.57");
    expect(card.detail).toContain("36.50");
    expect(card.detail).toContain("32.59");
    expect(model.ageLine).toContain("aged 10");
    expect(model.ageLine).toContain("age 11");
  });

  it("treats a disqualification as no time", () => {
    const html = `<h3>Female 50m Freestyle - Heats</h3><table><tr><td>Place</td><td>Name</td><td>Club</td><td>Time</td></tr>
      <tr><td>1</td><td>Mia Clarke</td><td>Warrington Warriors SC</td><td>DQ 2.3</td></tr></table>`;
    const row = parseResultPage(html).rows[0];
    expect(row.status).toBe("dq");
    expect(row.time).toBeNull();
  });
});

describe("qualifying comparison and windows", () => {
  it("describes a shortfall when the swim is slower than both standards", () => {
    const comparison = compareStandards({
      event: { distance: 50, stroke: "freestyle" },
      gender: "female",
      yearOfBirth: 2016,
      swim: { course: "SC", time: 4000 },
      shortCoursePb: 4000,
      longCoursePb: null,
    });
    expect(comparison.summary).toMatch(/^Needs .* more for county/);
    expect(comparison.tone).toBe("short");
    expect(pbLine(4000, 3589, "SC")).toBe("+4.11s vs the published short course PB");
    expect(pbLine(3500, 3589, "SC")).toBe("−0.89s vs the short course PB from before this result");
    expect(pbLine(3589, 3589, "SC")).toContain("not used as the time from before the meet");
  });

  it("uses a faster gala swim against the standards, and the older PB only as the previous best", () => {
    const comparison = compareStandards({
      event: { distance: 50, stroke: "freestyle" },
      gender: "female",
      yearOfBirth: 2016,
      swim: { course: "SC", time: 3500 },
      shortCoursePb: 3589,
      longCoursePb: null,
    });
    expect(comparison.summary).toContain("1.50s");
    expect(comparison.detail).toContain("this short course swim");
  });

  it("says whether a swim date is inside the published windows", () => {
    expect(qualifyingWindowLine("27/09/26")).toBe("In the county and regional qualifying windows.");
    expect(qualifyingWindowLine("01/02/26")).toBe(
      "In the county window. Before the regional window, which opens 4 May 2026.",
    );
    expect(qualifyingWindowLine("01/04/27")).toContain("After the regional deadline");
  });
});

describe("rankings", () => {
  it("parses a real Cheshire rankings table and finds Mia", () => {
    const table = parseRankingPage(fixture("fixtures/rankings-cheshire-50-free-sc.html"));
    expect(table.title).toContain("Last 12 Months");
    expect(table.title).toContain("31st December 2026");
    const mia = findRankingRow(table, "1820449", "Mia Clarke");
    expect(mia?.rank).toBe(3);
    expect(mia?.time).toBe(3589);
    expect(mia?.dateText).toBe("27/09/26");
    expect(mia?.meet).toContain("Splash");
    expect(findRankingRow(table, "000", "Someone Else")).toBeNull();
    expect(table.rows[0].name).toBe("Esme Fraser");
  });

  it("keeps a tied swimmer when Swim England leaves the rank blank", () => {
    const html = `<table id="rankTable"><tr><th>Rank</td><th>Name</td><th>Time</td><th>Date</td></tr>
      <tr><td>99</td><td><a href="/x?tiref=1">A Swimmer</a></td><td>34.93</td><td>01/05/26</td></tr>
      <tr><td>&nbsp;</td><td><a href="/x?tiref=2">B Swimmer</a></td><td>34.93</td><td>02/05/26</td></tr></table>`;
    const table = parseRankingPage(html);
    expect(table.rows.map((row) => row.rank)).toEqual([99, 99]);
  });

  it("builds the last-12-months rankings URL", () => {
    const url = rankingListUrl({
      course: "SC",
      strokeCode: "1",
      sex: "F",
      ageGroup: "10",
      ageAt: "31/12/2026",
      start: 1,
      level: "county",
    });
    expect(url).toContain("last12.php");
    expect(url).toContain("Pool=S");
    expect(url).toContain("Stroke=1");
    expect(url).toContain("AgeGroup=10");
    expect(url).toContain("TargetCounty=CHRN");
    expect(url).toContain("Level=C");
  });

});

describe("results discovery", () => {
  it("reads the club live-results link and ignores other links", () => {
    const html = `<a href="https://www.swimwarriors.org.uk/galas">Galas</a>
      <a href="https://swimwarriors.z33.web.core.windows.net/index.htm">Live results</a>`;
    expect(findResultsIndex(html)).toBe("https://swimwarriors.z33.web.core.windows.net/index.htm");
    expect(findResultsIndex("<p>No results link</p>")).toBeNull();
  });

  it("uses a saved link, then the discovered meet, then RESULTS_INDEX_URL", () => {
    const saved = chooseResultsSource({
      saved: { url: "https://example.test/index.htm", savedAt: "2026-11-10T17:00:00.000Z" },
      discovered: "https://club.test/index.htm",
      fallback: "https://env.test/index.htm",
    });
    expect(saved.url).toBe("https://example.test/index.htm");
    expect(saved.how).toContain("saved in Settings");
    expect(saved.how).toContain("10 Nov 2026");

    const discovered = chooseResultsSource({
      saved: null,
      discovered: "https://club.test/index.htm",
      fallback: "https://env.test/index.htm",
    });
    expect(discovered.url).toBe("https://club.test/index.htm");

    const fallback = chooseResultsSource({ saved: null, discovered: null, fallback: "https://env.test/index.htm" });
    expect(fallback.url).toBe("https://env.test/index.htm");
    expect(fallback.how).toContain("RESULTS_INDEX_URL");
  });

  it("accepts a SportSystems index and rejects a single race page", () => {
    const index = assessResultsHtml(fixture("fixtures/sportsystems/index.htm"));
    expect(index.ok).toBe(true);
    if (index.ok) expect(index.kind).toBe("frameset");
    const before = assessResultsHtml(fixture("fixtures/sportsystems/before.htm"));
    expect(before.ok).toBe(true);
    if (before.ok) expect(before.kind).toBe("meet");
    expect(assessResultsHtml(fixture("fixtures/sportsystems/RG1H103.HTM")).ok).toBe(false);
    expect(assessResultsHtml("<html><body><h1>Not results</h1></body></html>").ok).toBe(false);
    expect(httpUrl("javascript:alert(1)")).toBeNull();
    expect(httpUrl("https://swimwarriors.z33.web.core.windows.net/index.htm")).toContain("index.htm");
  });
});

describe("swim manager", () => {
  it("recognises the login page", () => {
    const html = fixture("fixtures/swimmanager-login.html");
    expect(isSwimManagerLogin(html, "https://warringtonw.swimmanager.co.uk/login")).toBe(true);
  });
});
