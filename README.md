# Welcome to Texas Flyer Generator

Static browser-based flyer generator for the Tri-Win sales team.

## How it works

- The activity menu is stored in `activities.json`.
- The locked flyer artwork is stored in `template-source.pdf`.
- PDF page 1 is rendered in the browser with the bundled files in `vendor/`.
- The generated flyer can be printed or saved as a PDF from the browser.
- No server-side code, database, or build process is required.

## Static deployment files

Publish the contents of this folder as-is:

```text
.nojekyll
activities.json
app.js
index.html
styles.css
template-source.pdf
vendor/pdf.mjs
vendor/pdf.worker.mjs
```

## GitHub Pages

See `DEPLOYMENT.md` for step-by-step instructions.

## Cloudflare Pages

See `DEPLOYMENT.md` for step-by-step instructions.
