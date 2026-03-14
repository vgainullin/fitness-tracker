# Setup

## Frontend (automatic)
Deployed to GitHub Pages on every push to main.
One-time: Repo Settings > Pages > Source: GitHub Actions

## AI Coach proxy (automatic)
Cloudflare Worker deploys on push to main.
One-time: add these to GitHub repo settings:
- Secret: `CLOUDFLARE_API_TOKEN` (create at dash.cloudflare.com > API Tokens > Create Token > Edit Workers)
- Variable: `CLOUDFLARE_ACCOUNT_ID` (visible on your CF dashboard)

## Google Sheets sync (optional, one-time)
1. Go to console.cloud.google.com > create project (or use existing)
2. Enable Google Sheets API
3. APIs & Services > Credentials > Create OAuth Client ID > Web application
4. Add authorized JS origins: `https://vgainullin.github.io` and `http://localhost:8080`
5. Copy the Client ID into the app's Settings tab

Users sign in with Google in the app. A spreadsheet is auto-created in their Drive.
