// Owner helper: writes public/announcement.json
//
//   npm run announce -- closed "2026-10-15 14:00" "2026-10-16 09:00" "Closed for a family event."
//   npm run announce -- early  "2026-10-15 20:00" ""                 "Closing early today."
//   npm run announce -- notice ""                 "2026-10-21 00:00" "Special timing for the festival."
//   npm run announce:clear
//
// Times are INDIA time. Use "" for "none".
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'announcement.json');
const [kind, from = '', until = '', ...rest] = process.argv.slice(2);
const message = rest.join(' ').trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/;

const usage = `Usage:
  npm run announce -- closed "YYYY-MM-DD HH:mm" "YYYY-MM-DD HH:mm" "Message"
  npm run announce -- early  "YYYY-MM-DD HH:mm" "" "Message"
  npm run announce -- notice "" "" "Message"
  npm run announce:clear`;

function fail(text) {
  console.error('Error: ' + text + '\n\n' + usage);
  process.exit(1);
}
function norm(label, value) {
  if (!value) return '';
  if (!DATE_RE.test(value)) fail(`${label} must look like 2026-10-15 14:00 (India time)`);
  return value.replace(' ', 'T');
}

let out;
if (kind === 'clear') {
  out = { active: false, type: 'closed', title: '', message: '', startsAt: '', reopensAt: '' };
} else if (['closed', 'early', 'notice'].includes(kind)) {
  const startsAt = norm('Start time', from);
  const reopensAt = norm('Reopen/end time', until);
  if ((kind === 'closed' || kind === 'early') && !startsAt) fail('This type needs a start time.');
  if (startsAt && reopensAt && reopensAt <= startsAt) fail('Reopen time must be after the start time.');
  const titles = { closed: 'Parlour temporarily closed', early: 'Closing early', notice: 'Special notice' };
  out = { active: true, type: kind, title: titles[kind], message, startsAt, reopensAt };
} else {
  fail('First word must be closed, early, notice, or clear.');
}

out.updatedAt = new Date().toISOString();
const body = {
  _help: 'Owner file. active=true shows the notice. type: closed | early | notice. Times are INDIA time: YYYY-MM-DDTHH:mm. Set active=false to cancel. See README.md.',
  ...out
};
writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
console.log('Saved ' + file);
console.log(JSON.stringify(body, null, 2));
console.log('\nNow commit and push so the website updates (about 1-2 minutes).');
