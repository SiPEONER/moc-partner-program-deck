# MOC Partner Program: live deck

A shareable, web version of `moc-global-pitchdeck-v3a.pptx` (since 2026-10-24, the brand-fixed copy
`moc-global-pitchdeck-v3a (brand fixes 2026-10-24).pptx` in Andy's Claude outputs folder). Every slide after
the cover is rendered straight from your finished PowerPoint design. Nothing
was redesigned. The cover is the one live piece: a real HTML layout (not an
image) so the partner logo slot actually works.

What it does:
- Click/tap, arrow keys, or swipe to move through slides. A "Present" button
  goes fullscreen.
- A **Customize** panel lets a sales manager hide slides they don't want for
  a given pitch, reorder slides within their section using the up/down
  arrows next to each one, drop in the prospect's logo, and fill in the two
  blank data tables (slides 14 and 22) with their own, then copy a link
  that carries those choices. The master deck underneath is never changed;
  every customization lives only in that one link.

## Reordering slides

Each slide row in the Customize panel has small up/down arrows on the
right. They only move a slide within its own section (e.g. within "PER
R.O." or "MOC 360"). The arrow is grayed out once a slide is first or last
in its section, so there's no way to drag something into the wrong part of
the deck. The cover slide is fixed and has no arrows.

The new order is saved in the share link the same way hidden slides and
custom logos are, so a reordered deck can still be copied and sent as a
link without touching the master files.

## Slides 14 and 22 are blank, and fillable

Both are a screenshot of an empty spreadsheet in the source deck: gray
header row, gray label column, no data in any cell. They're off by default.

The customize panel has a **"Paste image link…"** field directly under each
one. Paste a link to an image and it replaces the blank placeholder on that
slide (and switches it on automatically). No deploy, no code change, just
that one share link. Everyone on the team has Microsoft 365, so this uses
what's already there: a screenshot, hosted on OneDrive.

1. Screenshot the table: `Cmd+Shift+4` on a Mac or `Win+Shift+S` on Windows,
   dragged around the Excel range.
2. Save the screenshot to a OneDrive folder.
3. Right-click the file → **Share** → set it to "Anyone with the link can
   view" → **Copy link**.
4. Paste that link straight into the field, no editing needed. The app
   recognizes OneDrive/SharePoint links automatically and fixes them up
   internally (they normally open a preview page instead of the raw image;
   previously this required manually adding `&download=1` to the URL, but
   that step is now automatic).
5. To update the numbers later, re-save a new screenshot **over that same
   file**. The link doesn't change, so nothing needs re-pasting.

**Important:** the "Anyone with the link can view" setting in step 3 is the
one step that can't be automated. If a file is shared only to "People in
[org]," the image will fail to load for anyone outside your Microsoft 365
tenant, which is exactly who's viewing the deck. Test any new link in an
incognito window (logged out of Microsoft) before sending it out.

There's a "Remove" link next to the field to go back to the blank
placeholder at any time.

## Deploy

One process for every MOC site: push to `main` on GitHub (`SiPEONER/moc-partner-program-deck`)
and Vercel deploys it automatically to moc-partner-program-deck.vercel.app. No CLI or upload
deploys. It's a plain static site: no build step, no `api/` folder, no storage.

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

Commit as `SiPEONER <SiPEONER@users.noreply.github.com>` so Vercel matches the author to the team.

### Future updates

Whenever Creative finalizes a new version of the deck:

1. Export the updated `.pptx` to slide images the same way this version was
   built (or ask Claude to redo that conversion from a new file).
2. Replace the files in `slides/`, update `slides-data.js` if the slide count
   or order changed, commit, and push to `main`.
3. Sales managers' existing links keep working. Slide numbers that still
   exist keep showing; numbers that got removed just drop out quietly.

## Project structure

```
index.html         the whole viewer + customize drawer markup
styles.css          all styling
app.js              viewer logic, slide hide/show, logo apply, share-link state
slides-data.js      slide labels, sections, and default show/hide per slide
slides/             slide-02.webp … slide-32.webp (slide 1 is built live)
assets/             moc-box-logo.png
```
