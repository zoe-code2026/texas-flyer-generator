# Static Website Deployment

This app is ready for static hosting. All PDF rendering and flyer generation run in the visitor's browser.

## Option 1: GitHub Pages

### Create the repository

1. Sign in to GitHub.
2. Click **New repository**.
3. Name the repository, for example: `texas-flyer-generator`.
4. Choose **Public** if you want to use GitHub Pages with a free GitHub account.
5. Click **Create repository**.

### Upload the files

1. In the new repository, click **Add file** and then **Upload files**.
2. Upload the contents of this project folder.
3. Make sure the repository root contains:
   - `pdf.mjs`
   - `pdf.worker.mjs`
   - `pdf-lib.esm.min.js`
4. Click **Commit changes**.

### Enable GitHub Pages

1. Open the repository **Settings**.
2. Select **Pages** in the left sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the `main` branch and the `/ (root)` folder.
5. Click **Save**.
6. Wait a few minutes for deployment.

Your URL will look like:

```text
https://YOUR-GITHUB-USERNAME.github.io/texas-flyer-generator/
```

## Option 2: Cloudflare Pages

### Upload the static site directly

1. Sign in to Cloudflare.
2. Open **Workers & Pages**.
3. Click **Create application**.
4. Choose **Pages** and then **Upload assets**.
5. Enter a project name, for example: `texas-flyer-generator`.
6. Upload the contents of this project folder.
7. Click **Deploy site**.

Your URL will look like:

```text
https://texas-flyer-generator.pages.dev/
```

## Updating the activity menu

1. Edit `activities.json`.
2. Upload or commit the updated file.
3. Wait for the hosting service to publish the change.
4. Refresh the website.

## PDF export

1. Select activities.
2. Click **Generate Flyer**.
3. Click **Download Final PDF**.
4. Save the downloaded `welcome-to-texas-flyer.pdf` file.

The final file is generated directly in the browser as an exact Letter-size PDF. It does not depend on browser print scale, margins, or background-graphics settings.
