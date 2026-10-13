// ===== BIG BOSS PARLOUR — business details =====
// Change prices, phone, hours and owner name HERE. The whole website reads from this file.
// (The <title>/description in index.html are plain text and must be edited by hand.)

export const business = {
  name: 'BIG BOSS PARLOUR',
  tagline: 'YOUR STYLE. YOUR POWER.',
  timezone: 'Asia/Kolkata',

  owner: { name: 'Sayed Abdul Majid', role: 'Owner' },

  // Clean links (no tracking text).
  social: {
    reelUrl: 'https://www.instagram.com/reel/DTZPblQj7WC/',          // reel card in the owner section
    featuredReelUrl: 'https://www.instagram.com/reel/Dd3VAknRjPf/',  // reel card at the top of the page
    profileUrl: 'https://www.instagram.com/bigboss.21__/',
    handle: '@bigboss.21__'
  },

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
    { id: 'combo', name: 'Cutting + shaving', price: 99 },
    { id: 'scrubcut', name: 'Facial scrub + cutting', price: 149 },
    { id: 'massage', name: 'Body massage (per hour)', price: 499 },
    { id: 'bridalfacial', name: 'Bridal facial (wedding special)', price: 1499 },
    { id: 'bridalpkg', name: 'Special bridal package', price: 2000 }
  ],

  // Live counter + leaderboard. apiUrl '' = same site (npm run live). If the website is hosted somewhere
  // else (like GitHub Pages), put the address of your live server here, e.g. 'https://bigboss-live.onrender.com'.
  live: { apiUrl: '', pingMs: 15000 },

  // BigBoss Premium offer. Edit the perks to match what you really give members.
  premium: {
    name: 'BigBoss Premium',
    perks: [
      'Fast, priority cutting: premium customers are served first',
      'Your name on the live website leaderboard',
      'Every order the owner accepts moves you up the board'
    ]
  },

  // Owner notice file (see README.md). Fetched live, so no rebuild is needed to read it.
  announcementUrl: 'announcement.json',
  announcementRefreshMs: 120000
};
