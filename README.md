# BIG BOSS PARLOUR — cinematic website

## Run it
    npm install
    npm run dev        # http://localhost:5173
    npm test           # price, link, India-time and closure checks
    npm run build      # production build into dist/

## Change prices, phone, hours
Edit `src/config/business.js`. The page reads everything from there.
The page title/description in `index.html` are plain text: edit those by hand if prices change.

## Announce a closure (owner guide)
The website cannot know about an unexpected closure by itself. The owner must publish a notice.
Notices live in ONE file: `public/announcement.json`.

Option A — on GitHub, from a phone or laptop (no coding tools needed):
1. Open the repository on github.com, open `public/announcement.json`, press the pencil (edit) icon.
2. Set `"active": true`, choose `"type"`, fill `startsAt` / `reopensAt` (INDIA time, `YYYY-MM-DDTHH:mm`) and `message`.
3. Commit. GitHub redeploys automatically; the notice is live in about 1-2 minutes.
4. To cancel: set `"active": false` and commit.

Option B — terminal on your laptop:
    npm run announce -- closed "2026-10-15 14:00" "2026-10-16 09:00" "Closed for a family event."
    npm run announce -- early  "2026-10-15 20:00" "" "Closing early today."
    npm run announce -- notice "" "2026-10-21 00:00" "Special timing for the festival."
    npm run announce:clear
    git add -A && git commit -m "Update notice" && git push

Types: `closed` (shows TEMPORARILY CLOSED, overrides OPEN NOW), `early` (closes early, reopens next regular opening unless a reopen time is given), `notice` (info only).
Not instant: visitors see a change after the site redeploys (about 1-2 minutes).

## Deploy to GitHub Pages
1. Create an empty GitHub repository and push this project to the `main` branch.
2. Repository Settings > Pages > Source: **GitHub Actions**.
3. Every push to `main` runs tests, builds and publishes (see `.github/workflows/deploy.yml`).

## Test on an Android phone (same Wi-Fi)
Run `npm run dev`, then open the "Network" address it prints (like http://192.168.x.x:5173) on the phone.

## Photos
Put real, licensed photos in `public/images/`. The site currently uses SVG line art and a 3D scene, not photographs.
