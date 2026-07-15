// Variables used by Scriptable.
// icon-color: green; icon-glyph: map-marker-alt;

// Point Collector
//
// Captures your current location as a GeoJSON point and stores it in a
// FeatureCollection kept in iCloud Drive (Point Collector/points.geojson).
// Points captured while offline are queued on-device and merged into the
// iCloud collection the next time the script runs with a connection.

const PCGeoJSON = importModule("PCGeoJSON")
const PCLocation = importModule("PCLocation")
const PCStorage = importModule("PCStorage")

async function presentAlert(title, message) {
  const alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addAction("OK")
  await alert.present()
}

async function presentAddPoint() {
  const details = new Alert()
  details.title = "New Point"
  details.message = "Add an optional name and notes, then capture your current location."
  details.addTextField("Name (optional)", "")
  details.addTextField("Notes (optional)", "")
  details.addAction("Capture Location")
  details.addCancelAction("Cancel")
  const choice = await details.present()
  if (choice === -1) return

  const name = details.textFieldValue(0)
  const notes = details.textFieldValue(1)

  let location
  try {
    const result = await PCLocation.getCurrentReading({ timeoutSeconds: 20 })
    location = result.reading
  } catch (error) {
    await presentAlert("Location Unavailable", `Could not get your current location: ${error}`)
    return
  }

  const feature = PCGeoJSON.createPointFeature({
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude,
    horizontalAccuracy: location.horizontalAccuracy,
    verticalAccuracy: location.verticalAccuracy,
    name,
    notes
  })

  const result = await PCStorage.addPoint(feature)
  if (result.queued) {
    await presentAlert(
      "Point Queued",
      `No iCloud connection right now. The point was saved on this device and will sync automatically ` +
        `the next time Point Collector runs while online. (${result.pendingCount} pending)`
    )
  } else {
    await presentAlert("Point Saved", "The point was added to the iCloud feature collection.")
  }
}

async function presentSyncNow() {
  const result = await PCStorage.syncPending()
  if (result.synced) {
    await presentAlert(
      "Sync Complete",
      result.syncedCount > 0 ? `Synced ${result.syncedCount} pending point(s) to iCloud.` : "Nothing to sync — you're up to date."
    )
  } else {
    await presentAlert("Still Offline", `Could not reach iCloud yet. ${result.pendingCount} point(s) remain queued on this device.`)
  }
}

async function presentOpenCollection() {
  const path = PCStorage.collectionPath()
  if (!FileManager.iCloud().fileExists(path)) {
    await presentAlert("No Points Yet", "Add a point first to create the feature collection file.")
    return
  }
  QuickLook.present(path)
}

function statusSubtitle(status) {
  const saved = status.savedCount === null ? "unknown" : status.savedCount
  return `Saved: ${saved} · Pending: ${status.pendingCount}`
}

function actionRow(title, subtitle, action) {
  const row = new UITableRow()
  row.cellSpacing = 8
  row.addText(title, subtitle)
  row.onSelect = async () => {
    await action()
    await presentMainMenu()
  }
  return row
}

async function buildMainMenu() {
  const status = await PCStorage.getStatus()
  const table = new UITable()
  table.showSeparators = true

  const header = new UITableRow()
  header.isHeader = true
  header.addText("Point Collector", statusSubtitle(status))
  table.addRow(header)

  table.addRow(actionRow("Add Point", "Capture your current location", presentAddPoint))
  table.addRow(
    actionRow("Sync Now", status.pendingCount > 0 ? `${status.pendingCount} point(s) waiting` : "Nothing pending", presentSyncNow)
  )
  table.addRow(actionRow("Open Feature Collection", "View or share points.geojson", presentOpenCollection))

  return table
}

async function presentMainMenu() {
  const table = await buildMainMenu()
  await table.present(false)
}

async function run() {
  PCStorage.ensureDirectories()
  // Opportunistically flush any points queued from a previous offline run.
  await PCStorage.syncPending()
  await presentMainMenu()
}

await run()
Script.complete()
