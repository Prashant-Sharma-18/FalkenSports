// Fixtures as an iCalendar (.ics) file, built in the browser: phones and
// desktop calendars import it with one tap. No server, no account.
import { SPORTS, isUsStyle } from "./sports";

// Typical length of a game, for the calendar entry's end time.
const MINUTES = {
  football: 115,
  basketball: 150,
  "american-football": 195,
  hockey: 165,
  baseball: 180,
  cricket: 240,
  tennis: 120,
};

// 2026-10-30T19:45:00.000Z -> 20261030T194500Z
const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// 2026-10-30 (local) -> 20261030, for matches whose time isn't set yet.
const day = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const text = (s = "") => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

// UTF-8 length: names like "Süper Lig" or "Hülkenberg" take more bytes than characters.
// Surrogates (half an emoji each) count 2 bytes, so a half cut by slicing can't throw.
const bytes = (s) =>
  encodeURIComponent(s.replace(/[\uD800-\uDFFF]/g, "xx")).replace(/%[0-9A-F]{2}/g, "x").length;

// Lines longer than 75 octets are folded onto continuation lines (RFC 5545).
function fold(line) {
  const out = [];
  let rest = line;
  while (bytes(rest) > 75) {
    let cut = 74;
    while (bytes(rest.slice(0, cut)) > 74) cut -= 1;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

// "Heat at Hawks" for North American sports, "Arsenal v Chelsea" elsewhere.
export function matchTitle(m) {
  return isUsStyle(m.sport) ? `${m.away.name} at ${m.home.name}` : `${m.home.name} v ${m.away.name}`;
}

export function toIcs(matches, calendarName) {
  const now = utc(new Date());
  const events = matches
    .filter((m) => m.date && !isNaN(m.date))
    .map((m) => {
      const start = m.date;
      const end = new Date(start.getTime() + (MINUTES[m.sport] || 120) * 60 * 1000);
      const when = m.timeTbd
        ? [`DTSTART;VALUE=DATE:${day(start)}`]
        : [`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`];
      return [
        "BEGIN:VEVENT",
        `UID:${m.sport}-${m.league}-${m.id}@falkensports`,
        `DTSTAMP:${now}`,
        ...when,
        `SUMMARY:${text(matchTitle(m))}`,
        `DESCRIPTION:${text([m.competition, m.label, SPORTS[m.sport]?.name].filter(Boolean).join(" · "))}`,
        m.venue && `LOCATION:${text(m.venue)}`,
        "END:VEVENT",
      ].filter(Boolean);
    });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FalkenSports//Fixtures//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${text(calendarName)}`,
    ...events.flat(),
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}

// Hand the file to the browser as a download.
export function downloadIcs(matches, calendarName, filename) {
  const blob = new Blob([toIcs(matches, calendarName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "fixtures"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
