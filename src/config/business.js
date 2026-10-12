// ===== BIG BOSS PARLOUR — business details =====
// Change prices, phone and hours HERE. The whole website reads from this file.
// (The <title>/description in index.html are plain text and must be edited by hand.)

export const business = {
  name: 'BIG BOSS PARLOUR',
  tagline: 'YOUR STYLE. YOUR POWER.',
  timezone: 'Asia/Kolkata',

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

  services: [
    { id: 'haircut', name: 'Haircut', price: 100 },
    { id: 'beard', name: 'Beard shaving / grooming', price: 50 },
    { id: 'spa', name: 'Hair spa', price: 500 },
    { id: 'facial', name: 'Facial', price: 100 }
  ],

  // Owner notice file (see README.md). Fetched live, so no rebuild is needed to read it.
  announcementUrl: 'announcement.json',
  announcementRefreshMs: 120000
};
