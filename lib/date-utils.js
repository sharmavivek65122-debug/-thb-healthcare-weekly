const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const IST_TIME_ZONE = "Asia/Calcutta";

export const ISSUE_ANCHOR = createIstMidnightDate(2026, 1, 8);

export function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(date) {
  const parts = getIstParts(date);
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}`;
}

export function formatIssueRangeLabel(start, end) {
  return `${formatShortDate(start)} - ${formatShortDate(end)}, ${getIstParts(start).year}`;
}

export function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: IST_TIME_ZONE
  }).format(date);
}

export function formatLongDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: IST_TIME_ZONE
  }).format(date);
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function getWeekStartForDate(input) {
  const parts = getIstParts(input);
  const midnight = createIstMidnightDate(parts.year, parts.month, parts.day);
  return addDays(midnight, -parts.dayOfWeek);
}

export function getWeekEndFromStart(start) {
  return addDays(start, 6);
}

export function isIssueDay(date) {
  return getIstParts(date).dayOfWeek >= 0 && getIstParts(date).dayOfWeek <= 6;
}

export function getIssueNumber(start) {
  const diffDays = Math.round((getWeekStartForDate(start).getTime() - ISSUE_ANCHOR.getTime()) / DAY_MS);
  return Math.floor(diffDays / 7) + 1;
}

export function isInIssueWindow(date, start, end) {
  return date >= start && date < addDays(end, 1) && isIssueDay(date);
}

export function getLatestIssueStart(now = new Date()) {
  return getWeekStartForDate(now);
}

export function enumerateIssueWindows({ weeks = 8, now = new Date() } = {}) {
  const latestStart = getLatestIssueStart(now);
  const windows = [];

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = addDays(latestStart, -7 * index);
    if (start < ISSUE_ANCHOR) {
      continue;
    }

    const end = getWeekEndFromStart(start);
    windows.push({
      key: toIsoDate(start),
      issueNumber: getIssueNumber(start),
      start,
      end,
      rangeLabel: formatIssueRangeLabel(start, end)
    });
  }

  return windows;
}

export function getIssueStatus(windowInfo, now = new Date()) {
  const issueClose = addDays(windowInfo.end, 1);
  return now >= issueClose ? "published" : "live";
}

export function sortDatesDesc(left, right) {
  return right.getTime() - left.getTime();
}

function getIstParts(input) {
  const shifted = new Date(input.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay()
  };
}

function createIstMidnightDate(year, month, day) {
  return new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);
}

function pad(value) {
  return String(value).padStart(2, "0");
}
