# Yojna Ventures: countdown page

Plain HTML, CSS and Bootstrap (via CDN), with a little JavaScript. No build step.

## Files
- `index.html`: the page
- `css/style.css`: colors, type, layout
- `js/main.js`: countdown, dotted hills, rising eagle, logo hover light
- `assets/`: logo files and favicon

## Change the launch time
Open `js/main.js` and edit this line near the top:
`new Date('2027-05-14T00:00:00+05:30')` (IST, midnight at the start of 14 May 2027)

## Host on GitHub Pages
1. Create a new repository and upload everything in this folder (keep the folder structure).
2. Repository Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Your site goes live at `https://<your-username>.github.io/<repo-name>/` in a minute or two.

Test locally by opening `index.html` in a browser (needs internet for Bootstrap and fonts).
