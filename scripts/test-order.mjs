// Checks for the WhatsApp order message and link.
// Run with:  npm test
import { business } from '../src/config/business.js';
import { buildOrderMessage, buildOrderUrl, orderTotal, pickServices, money } from '../src/lib/orderMessage.js';

let passed = 0;
let failed = 0;
function check(name, condition, extra = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

console.log('Order message');
check('rupee format', money(1499) === '₹1,499', money(1499));
check('empty order gives no message and no link', buildOrderMessage([]) === '' && buildOrderUrl([]) === '');
check('bad input does not crash', buildOrderMessage(null) === '' && buildOrderMessage('x') === '' && buildOrderMessage(undefined) === '');
check('old removed services (saved in a browser) are ignored', pickServices(['beard', 'spa', 'facial']).length === 0 && buildOrderMessage(['beard', 'spa', 'facial']) === '');

let msg = buildOrderMessage(['haircut']);
check('single item line', msg.includes(`1. Stylish & normal cutting — ${money(49)}`), msg);
check('single item total', msg.includes(`Total: ${money(49)}`), msg);
check('greeting names the shop', msg.startsWith('Hello Big Boss Parlour! I would like to place this order:'), msg);

msg = buildOrderMessage(['bridalpkg', 'haircut', 'combo']);
const lines = msg.split('\n');
check('items follow menu order, numbered', lines[2] === `1. Stylish & normal cutting — ${money(49)}` && lines[3] === `2. Cutting + shaving — ${money(99)}` && lines[4] === `3. Special bridal package — ${money(2000)}`, msg);
check('total adds up (49 + 99 + 2000)', orderTotal(pickServices(['bridalpkg', 'haircut', 'combo'])) === 2148 && msg.includes(`Total: ${money(2148)}`), msg);

msg = buildOrderMessage(['haircut', 'haircut', 'nope']);
check('duplicates and unknown ids are ignored', pickServices(['haircut', 'haircut', 'nope']).length === 1 && msg.includes(`Total: ${money(49)}`) && !msg.includes('2.'), msg);

const allIds = business.services.map((s) => s.id);
check('all 6 services total 4295', orderTotal(pickServices(allIds)) === 4295, String(orderTotal(pickServices(allIds))));
check('all 6 services are listed', buildOrderMessage(allIds).split('\n').filter((l) => /^\d+\. /.test(l)).length === 6);

console.log('Customer name');
msg = buildOrderMessage(['haircut'], '  Ali\nKhan  ');
check('name is cleaned to one line', msg.includes('Name: Ali Khan') && !msg.includes('Ali\nKhan'), msg);
msg = buildOrderMessage(['haircut'], 'x'.repeat(100));
check('long name is cut to 60 characters', msg.split('\n').find((l) => l.startsWith('Name: ')).length === 'Name: '.length + 60);
check('no name line when the name is empty', !buildOrderMessage(['haircut'], '   ').includes('Name:'));

console.log('WhatsApp link');
const url = buildOrderUrl(['haircut', 'combo'], 'Rahul');
check('goes to the owner number', url.startsWith('https://wa.me/919937722001?text='), url);
check('link text decodes back to the exact message', decodeURIComponent(url.split('?text=')[1]) === buildOrderMessage(['haircut', 'combo'], 'Rahul'));
check('full order link is not too long', buildOrderUrl(allIds, 'Rahul').length < 2000, String(buildOrderUrl(allIds, 'Rahul').length));
check('message never claims a booking is confirmed', !/confirmed/i.test(buildOrderMessage(allIds)));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
