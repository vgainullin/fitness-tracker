# One-time clickops setup

## GitHub Pages
1. Repo Settings > Pages > Source: GitHub Actions

## Apps Script (optional, for GDrive sync)
1. Create a Google Cloud project at console.cloud.google.com
2. Enable the Apps Script API
3. Run `npx clasp login` locally, copy the token from `~/.clasprc.json`
4. Run `npx clasp create --type webapp --rootDir apps-script` to create the script
5. Run the `setup` function once in the Apps Script editor (creates sheets)
6. Deploy as Web App in the Apps Script editor to get the initial URL

## GitHub repo config
- Secret `CLASP_TOKEN`: paste the full JSON token object from `~/.clasprc.json`
- Variable `SCRIPT_ID`: the Apps Script project ID (from `.clasp.json` after create)

After this, every push to main auto-deploys both frontend and Apps Script.
