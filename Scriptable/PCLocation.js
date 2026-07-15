// PCLocation.js
// Reads the device's current GPS fix and caches the last successful reading
// locally (on-device, non-iCloud) so the home screen widget always has
// something to show even when a fresh fix can't be obtained in time.
// Scriptable-only module: relies on Location and FileManager.

const PCTimeout = importModule("PCTimeout")

const APP_FOLDER_NAME = "Point Collector"
const LAST_KNOWN_FILE_NAME = "last-known-location.json"

function localFm() {
  return FileManager.local()
}

function folderPath() {
  const fm = localFm()
  return fm.joinPath(fm.documentsDirectory(), APP_FOLDER_NAME)
}

function lastKnownPath() {
  const fm = localFm()
  return fm.joinPath(folderPath(), LAST_KNOWN_FILE_NAME)
}

function ensureFolder() {
  const fm = localFm()
  const folder = folderPath()
  if (!fm.fileExists(folder)) fm.createDirectory(folder, true)
}

function readLastKnown() {
  const fm = localFm()
  const path = lastKnownPath()
  if (!fm.fileExists(path)) return null
  try {
    return JSON.parse(fm.readString(path))
  } catch (error) {
    return null
  }
}

function writeLastKnown(reading) {
  ensureFolder()
  localFm().writeString(lastKnownPath(), JSON.stringify(reading))
}

// Attempts a fresh GPS fix within `timeoutSeconds`. On success, caches and
// returns it with `stale: false`. On timeout/failure, falls back to the
// last cached reading (`stale: true`) if one exists, otherwise rethrows.
async function getCurrentReading({ timeoutSeconds = 8, accuracy = "best" } = {}) {
  if (accuracy === "hundredMeters") {
    Location.setAccuracyToHundredMeters()
  } else {
    Location.setAccuracyToBest()
  }

  try {
    const location = await PCTimeout.withTimeout(Location.current(), timeoutSeconds)
    const reading = {
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude,
      horizontalAccuracy: location.horizontalAccuracy,
      verticalAccuracy: location.verticalAccuracy,
      timestamp: new Date().toISOString()
    }
    writeLastKnown(reading)
    return { reading, stale: false }
  } catch (error) {
    const cached = readLastKnown()
    if (cached) return { reading: cached, stale: true }
    throw error
  }
}

module.exports = { readLastKnown, writeLastKnown, getCurrentReading }
