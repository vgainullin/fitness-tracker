# Setup

## Frontend (automatic)
Deployed to GitHub Pages on every push to main.
One-time: Repo Settings > Pages > Source: GitHub Actions

## AI Coach proxy (automatic)
Cloudflare Worker deploys on push to main.
One-time: add these to GitHub repo settings:
- Secret: `CLOUDFLARE_API_TOKEN` (create at dash.cloudflare.com > API Tokens > Create Token > Edit Workers)
- Variable: `CLOUDFLARE_ACCOUNT_ID` (visible on your CF dashboard)

## Google sign-in (one-time)
The app asks only for `openid`, `email` and `drive.file`. All three are non-sensitive, so no
security review or test-user list is needed, and any Google account can sign in.

1. console.cloud.google.com > APIs & Services > Library: enable the **Google Sheets API** and **Google Drive API**.
2. Credentials > OAuth Client ID (Web application). Authorized JS origins: `https://vgainullin.github.io` and `http://localhost:8080`. Put the client ID in `GOOGLE_CLIENT_ID` in `public/index.html`.
3. Google Auth Platform > Data Access: list only `openid`, `.../auth/userinfo.email` and `.../auth/drive.file`.
4. Branding: homepage `https://vgainullin.github.io/fitness-tracker/about.html`, privacy policy `https://vgainullin.github.io/fitness-tracker/privacy.html`.
5. Audience: publishing status **In production**.

Each user's data lives in an "Iron Log Data" spreadsheet in their own Drive. On-device data is kept in a
separate IndexedDB database per Google account.
