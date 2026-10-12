// Opening-hours + closure-notice logic. Pure functions: no DOM, easy to test.
// Everything is calculated in India time (Asia/Kolkata), never the visitor's time zone.
import { business } from '../config/business.js';

const TZ = business.timezone;
const DAY_MS = 86400000;
const KINDS = ['closed', 'early', 'notice'];

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const stampFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short',
  hour: 'numeric', minute: '2-digit', hour12: true
});
const clockFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true
});

const pad = (n, len = 2) => String(n).padStart(len, '0');
const upperMeridiem = (s) => s.replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function istParts(date) {
  const p = {};
  for (const part of partsFormat.formatToParts(date)) p[part.type] = part.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute };
}

const dayKey = (date) => {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

// Reads "YYYY-MM-DDTHH:mm" (or with a space) as INDIA time. India has no daylight saving.
export function parseIST(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatIST = (date) => upperMeridiem(stampFormat.format(date));
export const formatClock = (date) => upperMeridiem(clockFormat.format(date));

export function regularStatus(now = new Date()) {
  const p = istParts(now);
  const minutes = p.hour * 60 + p.minute;
  const { openMinutes, closeMinutes } = business.hours;
  return { open: minutes >= openMinutes && minutes < closeMinutes, minutes };
}

export function nextRegularOpening(from) {
  const p = istParts(from);
  const minutes = p.hour * 60 + p.minute;
  const midnight = parseIST(`${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T00:00`);
  const addDays = minutes < business.hours.openMinutes ? 0 : 1;
  return new Date(midnight.getTime() + addDays * DAY_MS + business.hours.openMinutes * 60000);
}

function opensHeadline(now) {
  const when = regularStatus(now).minutes < business.hours.openMinutes ? 'today' : 'tomorrow';
  return `Opens ${when} at ${business.hours.openLabel}`;
}

function closedResult(base, headline, alert) {
  return { ...base, state: 'temp-closed', tone: 'closed', badge: 'TEMPORARILY CLOSED', headline, alert };
}

function evaluateClosure({ base, now, start, end, title, message }) {
  const from = start || new Date(0); // no start time = closed right away
  if (end && now >= end) return base; // announcement expired
  if (now < from) {
    return {
      ...base,
      alert: {
        label: 'CLOSURE ANNOUNCED', tone: 'warn',
        title: title || 'The parlour will be temporarily closed', message,
        lines: [
          `Closed from ${formatIST(from)}`,
          end ? `Expected to reopen: ${formatIST(end)}` : 'Reopening time will be announced.'
        ]
      }
    };
  }
  return closedResult(base, 'Temporarily closed', {
    label: 'TEMPORARILY CLOSED', tone: 'closed',
    title: title || 'The parlour is temporarily closed', message,
    lines: [end ? `Expected to reopen: ${formatIST(end)}` : 'Reopening time not announced yet. Please call or message before travelling.']
  });
}

function evaluateEarly({ base, now, start, end, title, message }) {
  const reopen = end || nextRegularOpening(start);
  if (now >= reopen) return base;
  if (now < start) {
    const sameDay = dayKey(now) === dayKey(start);
    return {
      ...base,
      alert: {
        label: sameDay ? 'CLOSING EARLY TODAY' : 'EARLY CLOSING ANNOUNCED', tone: 'warn',
        title: title || `Closing early at ${formatClock(start)}`, message,
        lines: [
          sameDay
            ? `We close at ${formatClock(start)} today instead of ${business.hours.closeLabel}.`
            : `Closing at ${formatIST(start)}.`
        ]
      }
    };
  }
  return closedResult(base, 'Closed early', {
    label: 'CLOSED EARLY', tone: 'closed',
    title: title || 'The parlour closed early', message,
    lines: [
      `Closed since ${formatIST(start)}`,
      end ? `Expected to reopen: ${formatIST(end)}` : `Reopens at regular time: ${formatIST(reopen)}`
    ]
  });
}

function evaluateNotice({ base, now, start, end, title, message }) {
  if (start && now < start) return base;
  if (end && now >= end) return base;
  return {
    ...base,
    alert: {
      label: 'SPECIAL NOTICE', tone: 'notice',
      title: title || 'Special notice', message,
      lines: end ? [`Notice valid until ${formatIST(end)}`] : []
    }
  };
}

// announcement = parsed announcement.json (or null). Returns what the page should show.
export function evaluateStatus(announcement, now = new Date()) {
  const regular = regularStatus(now);
  const base = {
    state: regular.open ? 'open' : 'closed-hours',
    tone: regular.open ? 'open' : 'closed',
    badge: regular.open ? 'OPEN NOW' : 'CLOSED NOW',
    headline: regular.open ? `Open today until ${business.hours.closeLabel}` : opensHeadline(now),
    alert: null,
    regularOpen: regular.open
  };

  if (!announcement || typeof announcement !== 'object' || announcement.active !== true) return base;

  const kind = KINDS.includes(announcement.type) ? announcement.type : 'notice';
  const ctx = {
    base, now,
    start: parseIST(announcement.startsAt),
    end: parseIST(announcement.reopensAt) || parseIST(announcement.endsAt),
    title: cleanText(announcement.title, 120),
    message: cleanText(announcement.message, 500)
  };

  if (kind === 'closed') return evaluateClosure(ctx);
  if (kind === 'early' && ctx.start) return evaluateEarly(ctx);
  return evaluateNotice(ctx);
}
