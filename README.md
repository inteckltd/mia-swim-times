# Mia Clarke swim times

A private, mobile-first page for one parent. After a gala, open it on a phone and see Mia’s personal bests, the time she just swam, the gap to that best, and the gap to the Cheshire County and North West qualifying standards. A Rankings tab shows her place in the same birth year at county, regional and national level, for short course and long course.

There is no database. Pages are fetched on the server and cached.

## What it shows

- Personal bests from the public Swim England biography for membership `1820449`: [biogs_details.php?tiref=1820449](https://www.swimmingresults.org/biogs/biogs_details.php?tiref=1820449). Long course and short course are kept separate.
- The meet currently published on the club SportSystems index. That index is a frameset; the app reads the event list, then the result and start-list pages, and keeps rows for Mia at Warrington.
- Entry times from those start lists. The Warrington Swim Manager meet page redirects to a club login, so it is not a source of times.
- Cheshire County 2027 consideration times and Swim England North West 2027 qualifying times for girls born in 2016 (age 11 at 31 December 2027). They live in [`data/qualifying-times.json`](data/qualifying-times.json) with the source PDFs. Edit that file when the next set is published.
- Course conversion with the Swim England equivalent-time algorithm, including the published check that 100m backstroke in 63.5 seconds long course becomes 62.2 short course. 100m IM has no published factor, so it is not converted.
- Rankings for the last 12 months, girls aged 10 at 31 December 2026. That is the same birth year as the 2027 standards. Each event she has a time for is looked up for Cheshire, North West, and the all-members national list, on each course. The date of the ranked swim is checked against the county and regional qualifying windows.

The whole site asks for `APP_PASSCODE` and sends `noindex`.

## Setup

```bash
npm install
cp .env.example .env.local
# put a long passcode in APP_PASSCODE
npm test
npm run dev
```

Open the URL Next prints, enter the passcode, and use Refresh after a race. Rankings are the second tab.

### Environment

| Variable | Purpose |
| --- | --- |
| `APP_PASSCODE` | Required. Shared family passcode. The app shows nothing until this is set. |
| `RESULTS_INDEX_URL` | SportSystems `index.htm`. The Warriors site hosts one meet at a time. |
| `MEET_COURSE` | `SC` or `LC`. Home meets at Orford Jubilee are short course. |
| `SWIMMANAGER_MEET_URL` | Optional. Leave empty to skip. A login page is reported, not scraped. |
| `SWIMMER_NAME` | Checked against the biography. A different swimmer is ignored. |
| `SWIMMER_MEMBERSHIP` | Swim England number. Default `1820449`. |
| `SWIMMER_CLUB_MATCH` | Club text that must appear on a result row. Default `Warrington`. |
| `SWIMMER_YEAR_OF_BIRTH` | Used only if the biography has no year of birth. |
| `SWIMMER_GENDER` | Used only if the biography has no category. |
| `RANKINGS_AGE_AT` | `DD/MM/YYYY` passed to the rankings form. Default `31/12/2026`. |
| `REVALIDATE_SECONDS` | Cache for the biography and gala pages. Default 180. Minimum 60. |
| `RANKINGS_REVALIDATE_SECONDS` | Cache for each rankings list. Default 3600. Minimum 300. |

## Vercel

Import the repository, set the same environment variables for Production, and do not commit `.env.local`. The rankings route sets `maxDuration` to 60 seconds because the first load reads one Swim England list per event, course and level. Later loads use the cache. Refresh clears both caches.

This project was not deployed from here.

## Tests

`npm test` parses saved pages, not the live sites:

- Swim England biography
- SportSystems frameset, event index, 50m freestyle result and start list
- Cheshire last-12-months rankings table, including the real header markup
- Equivalent times, qualifying gaps, and whether a swim date sits in the county and regional windows

## Caveats

- The individual best page at `personal_best.php` returns a Cloudflare check to this app. Personal bests come from `biogs_details.php`, which was readable and carries the same long course and short course bests. If that page starts returning a check, the app says so and does not fill in times.
- Rankings come from `12months/last12.php`. When that was checked, it returned normal HTML. If it starts returning a bot check, the Rankings tab says the lists were blocked and leaves the places blank.
- Each rankings request returns at most 100 names. The app reads the following pages in order and stops after five pages, which is 500 places. A place beyond that is reported as not found. It is not estimated. A blank rank on the Swim England page is a tie with the swimmer above.
- “National” is Swim England’s all-members list (England, Scotland, Wales and the Crown Dependencies), not a separate England-only column.
- Rankings are age 10 at 31 December 2026. The county and regional standards are age 11 at 31 December 2027. Both are girls born in 2016. The page says this.
- County times are consideration times, not a promise of a place. The county PDF says times since 1 January 2026 and does not give an entry closing date. North West times must be achieved from 4 May 2026 until 31 March 2027. A ranked swim is marked against those windows using the date Swim England prints.
- The results index currently has to be the meet the club has published. Point `RESULTS_INDEX_URL` at the Percy Mason index when that meet replaces the one online now.
- Times in the JSON file were copied from the published PDFs on 10 November 2026. The county PDF prints two girls’ 13-year times with a doubled dot (`5.15..00` and `2.49..00`); those are stored as `5:15.00` and `2:49.00`.
