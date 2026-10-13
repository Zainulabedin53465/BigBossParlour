// Real checks for prices, links, India-time hours and closure notices.
// Run with:  npm test
import { parseIST, evaluateStatus, regularStatus } from '../src/lib/status.js';
import { business } from '../src/config/business.js';
import { telUrl, whatsappUrl } from '../src/lib/links.js';

let passed = 0;
let failed = 0;
function check(name, condition, extra = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}
const at = (s) => {
  const d = parseIST(s);
  if (!d) throw new Error('bad test date ' + s);
  return d;
};
const ev = (ann, s) => evaluateStatus(ann, at(s));

console.log('Business details');
const expectedPrices = { haircut: 49, combo: 99, scrubcut: 149, massage: 499, bridalfacial: 1499, bridalpkg: 2000 };
const prices = Object.fromEntries(business.services.map((s) => [s.id, s.price]));
for (const [id, price] of Object.entries(expectedPrices)) {
  check(`price ${id} = Rs ${price}`, prices[id] === price, `got ${prices[id]}`);
}
check('exactly 6 services, no duplicate ids', business.services.length === 6 && new Set(business.services.map((s) => s.id)).size === 6);
check('old services are gone (beard, spa, facial)', !('beard' in prices) && !('spa' in prices) && !('facial' in prices));
check('owner name', business.owner.name === 'Sayed Abdul Majid');
check('owner reel link is clean', business.social.reelUrl === 'https://www.instagram.com/reel/DTZPblQj7WC/');
check('featured reel link is clean', business.social.featuredReelUrl === 'https://www.instagram.com/reel/Dd3VAknRjPf/');
check('Instagram profile link and handle', business.social.profileUrl === 'https://www.instagram.com/bigboss.21__/' && business.social.handle === '@bigboss.21__');
check('hours 9:00 to 22:00', business.hours.openMinutes === 540 && business.hours.closeMinutes === 1320);
check('timezone is Asia/Kolkata', business.timezone === 'Asia/Kolkata');
check('tel link', telUrl() === 'tel:+919937722001', telUrl());
const wa = whatsappUrl();
check('WhatsApp link base', wa.startsWith('https://wa.me/919937722001?text='), wa);
check('WhatsApp prefilled text', decodeURIComponent(wa.split('?text=')[1]) === business.whatsappMessage);

console.log('Regular hours (India time, any computer time zone)');
check('08:59 IST closed', ev(null, '2026-10-12T08:59').state === 'closed-hours');
check('09:00 IST open', ev(null, '2026-10-12T09:00').state === 'open');
check('21:59 IST open', ev(null, '2026-10-12T21:59').state === 'open');
check('22:00 IST closed', ev(null, '2026-10-12T22:00').state === 'closed-hours');
check('absolute 03:30Z = 09:00 IST open', regularStatus(new Date('2026-10-12T03:30:00Z')).open === true);
check('absolute 03:29Z = 08:59 IST closed', regularStatus(new Date('2026-10-12T03:29:00Z')).open === false);
check('absolute 16:29Z = 21:59 IST open', regularStatus(new Date('2026-10-12T16:29:00Z')).open === true);
check('absolute 16:30Z = 22:00 IST closed', regularStatus(new Date('2026-10-12T16:30:00Z')).open === false);
check('open on a Sunday (2026-10-18)', ev(null, '2026-10-18T12:00').state === 'open');
check('inactive notice ignored', ev({ active: false, type: 'closed', startsAt: '2026-10-12T00:00' }, '2026-10-12T12:00').state === 'open');

console.log('Temporary closure with reopening time');
const closure = { active: true, type: 'closed', title: 'Closed for a family event', message: 'Sorry for the trouble.', startsAt: '2026-10-15T14:00', reopensAt: '2026-10-16T09:00' };
let r = ev(closure, '2026-10-15T13:59');
check('before start: still open + warning', r.state === 'open' && r.alert && r.alert.label === 'CLOSURE ANNOUNCED');
r = ev(closure, '2026-10-15T14:00');
check('at start: TEMPORARILY CLOSED', r.state === 'temp-closed' && r.badge === 'TEMPORARILY CLOSED');
r = ev(closure, '2026-10-15T20:00');
check('open hours but closure overrides', r.badge !== 'OPEN NOW' && r.state === 'temp-closed');
r = ev(closure, '2026-10-16T08:59');
check('just before reopening: still closed', r.state === 'temp-closed' && /reopen/i.test(r.alert.lines.join(' ')));
r = ev(closure, '2026-10-16T09:00');
check('at reopening: normal open, no alert', r.state === 'open' && r.alert === null);
r = ev(closure, '2026-10-17T12:00');
check('after expiry: normal open', r.state === 'open' && r.alert === null);

console.log('Closure without reopening time');
r = ev({ active: true, type: 'closed', startsAt: '2026-10-15T14:00' }, '2026-12-01T12:00');
check('stays closed until owner cancels', r.state === 'temp-closed' && /not announced/i.test(r.alert.lines.join(' ')));

console.log('Closing early');
const early = { active: true, type: 'early', startsAt: '2026-10-15T20:00' };
r = ev(early, '2026-10-15T19:59');
check('before: open + CLOSING EARLY TODAY', r.state === 'open' && r.alert.label === 'CLOSING EARLY TODAY');
r = ev(early, '2026-10-15T20:00');
check('at time: temporarily closed', r.state === 'temp-closed');
r = ev(early, '2026-10-15T21:00');
check('regular hours would be open, notice overrides', r.state === 'temp-closed');
r = ev(early, '2026-10-16T08:59');
check('next morning before 9: closed', r.state === 'temp-closed');
r = ev(early, '2026-10-16T09:00');
check('reopens at regular time', r.state === 'open' && r.alert === null);
r = ev(early, '2026-10-14T10:00');
check('different day label', r.alert.label === 'EARLY CLOSING ANNOUNCED');

console.log('Special notice');
const notice = { active: true, type: 'notice', message: 'Festival timing', startsAt: '2026-10-20T00:00', reopensAt: '2026-10-21T00:00' };
check('before window: hidden', ev(notice, '2026-10-19T12:00').alert === null);
r = ev(notice, '2026-10-20T12:00');
check('inside window: SPECIAL NOTICE, status unchanged', r.alert.label === 'SPECIAL NOTICE' && r.state === 'open');
check('after window: hidden', ev(notice, '2026-10-21T00:00').alert === null);

console.log('Bad data does not crash');
let crashed = false;
try {
  evaluateStatus(null); evaluateStatus('hello'); evaluateStatus(42);
  evaluateStatus({ active: true, type: 'closed', startsAt: 'garbage' });
  evaluateStatus({ active: true, type: 'banana' });
} catch (e) { crashed = true; }
check('no exceptions', !crashed);
r = evaluateStatus({ active: true, type: 'closed', startsAt: 'garbage' }, at('2026-10-12T12:00'));
check('closed with unreadable start = closed now', r.state === 'temp-closed');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
