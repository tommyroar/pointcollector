# Point Collector

An [iPhone Scriptable](https://scriptable.app) app for collecting geospatial
points in the field. Each captured point is written as a GeoJSON `Feature`
into a `FeatureCollection` stored in iCloud Drive, so the same dataset stays
in sync across every device running the script. Points captured while
offline are queued on-device and merged into the iCloud collection
automatically the next time the script runs with a connection.

## How it works

- **Add Point** captures your current GPS location (via `Location.current()`),
  lets you attach an optional name/notes, and writes a GeoJSON `Feature` with
  a `Point` geometry.
- **Storage** lives at `iCloud Drive/Scriptable/Point Collector/points.geojson`
  — a standard GeoJSON `FeatureCollection` you can open in any GIS tool
  (QGIS, Mapbox, geojson.io, etc.) or share straight from the script.
- **Offline queueing**: before writing to iCloud, the script checks for a
  live connection. If it's offline (or the iCloud write fails for any
  reason), the point is appended instead to a local, on-device queue file
  (`pending-points.json`, outside of iCloud) so it's never lost.
- **Syncing**: every time the script runs, it first checks for pending
  queued points and — if online — merges them into the iCloud
  `FeatureCollection`, deduping by each point's unique id so nothing is
  double-counted even if a merge is retried. You can also trigger this
  manually from the **Sync Now** menu item.
- **Home screen widget**: a separate widget script shows the last-known
  latitude/longitude/altitude/accuracy and how many points are queued for
  sync, without opening the app. See [Home screen widget](#home-screen-widget)
  below.

## Project layout

```
Scriptable/
  Point Collector.js         Main script — the UITable-based UI and app entry point
  Point Collector Widget.js   Home screen widget — last-known location + pending count
  PCGeoJSON.js                 Pure GeoJSON helpers (feature creation, merge/dedupe)
  PCLocation.js                GPS reads with a timeout + last-known-reading cache
  PCNetwork.js                 Connectivity check used to decide online vs. queued
  PCStorage.js                 iCloud FeatureCollection + local queue persistence
  PCTimeout.js                 Shared promise/timer race helper
test/
  PCGeoJSON.test.js             Jest tests for the pure GeoJSON logic
```

`PCGeoJSON.js` has no dependency on Scriptable-only globals, so it's the one
module covered by an automated (Node/Jest) test suite. The rest rely on
Scriptable's `Request`, `FileManager`, `Location`, `Timer`, and widget APIs
and are exercised by hand in the Scriptable app.

## Installing on your iPhone

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)
   and make sure iCloud Drive is enabled for it (Settings → your name →
   iCloud → iCloud Drive → Scriptable).
2. Copy every file under `Scriptable/` into the Scriptable app's iCloud
   folder: `iCloud Drive/Scriptable/`. The easiest way is to clone this repo
   somewhere and copy (or symlink) those files in via the Files app / Finder,
   since Scriptable loads scripts and `importModule` dependencies from that
   single flat folder. If you have the [continuous deploy](#continuous-deploy-to-iphone)
   pipeline set up, this happens automatically on every push to `main`.
3. Open the **Point Collector** script from the Scriptable app. On first run
   it will ask for location permission ("While Using the App" is enough).

### Home screen widget

1. Long-press the home screen → **+** → search for **Scriptable** → add a
   small or medium widget.
2. Edit the widget and set **Script** to `Point Collector Widget`.
3. The widget shows the last GPS reading it could get (falling back to the
   last cached reading if a fresh fix times out) and how many points are
   still queued for sync. iOS — not the script — decides how often a widget
   actually refreshes (typically every 15-30 minutes), so this is a
   periodically-updated snapshot, not a live, continuously-ticking readout.
   Open the widget script directly in Scriptable for an on-demand reading.

## Continuous deploy to iPhone

`.github/workflows/deploy-scriptable.yml` copies `Scriptable/*.js` onto a
self-hosted GitHub Actions runner after every successful `Test` run on
`main`, straight into that machine's local iCloud Drive "Scriptable"
folder. macOS's own iCloud sync then carries the update down to any iPhone
signed into the same iCloud account running Point Collector — no manual
copying, no custom deploy server. Since Apple doesn't expose a way for
GitHub (or any external service) to write into an iPhone's iCloud Drive
directly, "something you control" has to make that write locally; a Mac
mini already running as a self-hosted runner is exactly that.

Why this is safe to run as a self-hosted (rather than GitHub-hosted)
job: it's gated on `workflow_run` of the `Test` workflow completing with
`head_branch == main`. A pull request from a fork never has `main` as its
head branch, so a fork's `Test` run — which *does* execute on a
GitHub-hosted runner, fine either way — can never trigger the deploy job.
Only a real push/merge to `main` ever touches the self-hosted runner.

Setup checklist (using the runner already registered for the
`robogeosociety` org):

1. Confirm this repo has access to that runner (or its runner group) under
   the org's **Settings → Actions → Runners**.
2. Check the runner's labels and update `runs-on: [self-hosted, macOS]` in
   `deploy-scriptable.yml` if they don't match (e.g. a custom label was used
   at registration).
3. On the Mac mini, verify the exact iCloud folder name — it should be
   `~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents`, but
   confirm with `ls ~/Library/"Mobile Documents" | grep -i script` (or look
   for **Scriptable** under iCloud Drive in Finder) and adjust the `dest`
   path in the workflow if it differs.
4. Make sure the account running the runner service is actually signed into
   iCloud with iCloud Drive enabled — the runner process needs to be running
   in a full user session (not headless/root) for `~/Library/Mobile
   Documents` to be the real, syncing iCloud container.
5. Push to `main` and check the **Actions** tab for the `Deploy to
   Scriptable (Mac mini)` run.

This only copies known files by name (no directory-level delete), so it
never touches other, unrelated Scriptable scripts you might have in that
same iCloud folder. If a module is ever removed from this repo, its old
copy is left behind on the Mac/phone rather than being deleted.

## Development

The Scriptable-specific modules and both scripts can only be run inside the
Scriptable app, since they use its `FileManager`, `Location`, `Request`,
`Alert`, `UITable`, `Timer`, and widget APIs. The pure GeoJSON logic in
`PCGeoJSON.js` runs anywhere and has a Jest suite:

```
npm install
npm test
```
