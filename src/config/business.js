// ===== BIG BOSS PARLOUR — business details =====
// Change prices, phone, hours and owner name HERE. The whole website reads from this file.
// (The <title>/description in index.html are plain text and must be edited by hand.)

export const business = {
  name: 'BIG BOSS PARLOUR',
  tagline: 'YOUR STYLE. YOUR POWER.',
  timezone: 'Asia/Kolkata',

  owner: { name: 'Sk Abdul Majid', role: 'Owner' },

  // Clean link (no tracking text). Used by the owner reel cover card.
  social: { reelUrl: 'https://www.instagram.com/reel/DTZPblQj7WC/' },

  phoneDisplay: '+91 99377 22001',
  phoneE164: '+919937722001',
  whatsappNumber: '919937722001',
  whatsappMessage: 'Hello Big Boss Parlour! I would like to enquire about your services.',

  // Open seven days a week. Minutes after midnight, India time.
  hours: {
    openMinutes: 9 * 60,
    closeMinutes: 22 * 60,
    openLabel: '9:00 AM',
    closeLabel: '10:00 PM'
  },

  // The order here is the order on the price board (lowest to highest price).
  services: [
    { id: 'haircut', name: 'Stylish & normal cutting', price: 49 },
    { id: 'beard', name: 'Beard shaving / grooming', price: 50 },
    { id: 'combo', name: 'Cutting + shaving', price: 99 },
    { id: 'facial', name: 'Facial', price: 100 },
    { id: 'scrubcut', name: 'Facial scrub + cutting', price: 149 },
    { id: 'massage', name: 'Body massage (per hour)', price: 499 },
    { id: 'spa', name: 'Hair spa', price: 500 },
    { id: 'bridalfacial', name: 'Bridal facial (wedding special)', price: 1499 },
    { id: 'bridalpkg', name: 'Special bridal package', price: 2000 }
  ],

  // Owner notice file (see README.md). Fetched live, so no rebuild is needed to read it.
  announcementUrl: 'announcement.json',
  announcementRefreshMs: 120000
};
