# Setup

## Frontend (automatic)
Deployed to GitHub Pages on every push to main. No config needed beyond:
- Repo Settings > Pages > Source: GitHub Actions

## Backend (optional, 4 steps)
Only needed if you want GDrive sync / AI coach.

1. Go to script.google.com > New project
2. Paste the contents of `apps-script/Code.js`
3. Run the `setup` function (creates the spreadsheet and sheets)
4. Deploy > New deployment > Web app > Anyone > Deploy

Copy the URL into the app's Settings tab. Done.
