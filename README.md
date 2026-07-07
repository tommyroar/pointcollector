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

## Project layout

```
Scriptable/
  Point Collector.js   Main script — the UITable-based UI and app entry point
  PCGeoJSON.js          Pure GeoJSON helpers (feature creation, merge/dedupe)
  PCNetwork.js          Connectivity check used to decide online vs. queued
  PCStorage.js          iCloud FeatureCollection + local queue persistence
test/
  PCGeoJSON.test.js      Jest tests for the pure GeoJSON logic
```

`PCGeoJSON.js` has no dependency on Scriptable-only globals, so it's the one
module covered by an automated (Node/Jest) test suite. `PCNetwork.js` and
`PCStorage.js` rely on Scriptable's `Request`, `FileManager`, and `Timer`
APIs and are exercised by hand in the Scriptable app.

## Installing on your iPhone

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)
   and make sure iCloud Drive is enabled for it (Settings → your name →
   iCloud → iCloud Drive → Scriptable).
2. Copy the four files under `Scriptable/` into the Scriptable app's iCloud
   folder: `iCloud Drive/Scriptable/`. The easiest way is to clone this repo
   somewhere and copy (or symlink) those files in via the Files app / Finder,
   since Scriptable loads scripts and `importModule` dependencies from that
   single flat folder.
3. Open the **Point Collector** script from the Scriptable app. On first run
   it will ask for location permission ("While Using the App" is enough).

## Development

The Scriptable-specific modules (`PCNetwork.js`, `PCStorage.js`, and the main
script) can only be run inside the Scriptable app, since they use its
`FileManager`, `Location`, `Request`, `Alert`, `UITable`, and `Timer` APIs.
The pure GeoJSON logic in `PCGeoJSON.js` runs anywhere and has a Jest suite:

```
npm install
npm test
```
