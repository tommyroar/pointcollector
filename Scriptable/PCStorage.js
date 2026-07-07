// PCStorage.js
// Handles reading/writing the GeoJSON FeatureCollection in iCloud, plus a
// local (on-device, non-iCloud) queue used to hold points captured while
// offline. Scriptable-only module: relies on FileManager, Timer and
// importModule, so it can't be exercised from the Node test suite.

const PCGeoJSON = importModule("PCGeoJSON")
const PCNetwork = importModule("PCNetwork")
const PCTimeout = importModule("PCTimeout")

const APP_FOLDER_NAME = "Point Collector"
const COLLECTION_FILE_NAME = "points.geojson"
const QUEUE_FILE_NAME = "pending-points.json"
const ICLOUD_DOWNLOAD_TIMEOUT_SECONDS = 15

function icloudFm() {
  return FileManager.iCloud()
}

function localFm() {
  return FileManager.local()
}

function icloudFolderPath() {
  const fm = icloudFm()
  return fm.joinPath(fm.documentsDirectory(), APP_FOLDER_NAME)
}

function collectionPath() {
  const fm = icloudFm()
  return fm.joinPath(icloudFolderPath(), COLLECTION_FILE_NAME)
}

function localFolderPath() {
  const fm = localFm()
  return fm.joinPath(fm.documentsDirectory(), APP_FOLDER_NAME)
}

function queuePath() {
  const fm = localFm()
  return fm.joinPath(localFolderPath(), QUEUE_FILE_NAME)
}

function ensureDirectories() {
  const ifm = icloudFm()
  const icloudFolder = icloudFolderPath()
  if (!ifm.fileExists(icloudFolder)) {
    ifm.createDirectory(icloudFolder, true)
  }

  const lfm = localFm()
  const localFolder = localFolderPath()
  if (!lfm.fileExists(localFolder)) {
    lfm.createDirectory(localFolder, true)
  }
}

function readQueue() {
  const fm = localFm()
  const path = queuePath()
  if (!fm.fileExists(path)) return []
  try {
    const parsed = JSON.parse(fm.readString(path))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function writeQueue(features) {
  localFm().writeString(queuePath(), JSON.stringify(features))
}

function enqueuePoint(feature) {
  const queue = readQueue()
  queue.push(feature)
  writeQueue(queue)
  return queue
}

async function readCollectionFromICloud() {
  const fm = icloudFm()
  const path = collectionPath()
  if (!fm.fileExists(path)) return PCGeoJSON.emptyFeatureCollection()

  if (!fm.isFileDownloaded(path)) {
    await PCTimeout.withTimeout(fm.downloadFileFromiCloud(path), ICLOUD_DOWNLOAD_TIMEOUT_SECONDS)
  }

  try {
    const parsed = JSON.parse(fm.readString(path))
    return PCGeoJSON.isFeatureCollection(parsed) ? parsed : PCGeoJSON.emptyFeatureCollection()
  } catch (error) {
    return PCGeoJSON.emptyFeatureCollection()
  }
}

function writeCollectionToICloud(collection) {
  icloudFm().writeString(collectionPath(), JSON.stringify(collection, null, 2))
}

// Merges the local queue (plus an optional new feature) into the iCloud
// collection, writes the result back, and clears the queue on success.
async function flushQueue(extraFeature) {
  const collection = await readCollectionFromICloud()
  const queued = readQueue()
  const incoming = extraFeature ? [...queued, extraFeature] : queued
  const merged = PCGeoJSON.mergeFeatureCollections(collection, incoming)
  writeCollectionToICloud(merged)
  writeQueue([])
  return { collection: merged, syncedCount: incoming.length }
}

// Adds a newly captured point. Tries to write straight through to iCloud
// (flushing any already-queued points along the way); if there's no
// connection or the iCloud write fails, the point is queued locally instead.
async function addPoint(feature) {
  ensureDirectories()

  const online = await PCNetwork.isOnline()
  if (online) {
    try {
      const { collection, syncedCount } = await flushQueue(feature)
      return { queued: false, collection, syncedCount }
    } catch (error) {
      // Fall through to the local queue below.
    }
  }

  const queue = enqueuePoint(feature)
  return { queued: true, pendingCount: queue.length }
}

// Flushes any queued points to iCloud without adding a new one. Safe to
// call on every script launch as an opportunistic "sync once we're back
// online" step.
async function syncPending() {
  ensureDirectories()

  const pending = readQueue()
  if (pending.length === 0) return { synced: true, syncedCount: 0 }

  const online = await PCNetwork.isOnline()
  if (!online) return { synced: false, pendingCount: pending.length }

  try {
    const { syncedCount } = await flushQueue(null)
    return { synced: true, syncedCount }
  } catch (error) {
    return { synced: false, pendingCount: pending.length, error: String(error) }
  }
}

async function getStatus() {
  ensureDirectories()

  const pending = readQueue()
  let savedCount = null
  try {
    const fm = icloudFm()
    const path = collectionPath()
    if (fm.fileExists(path) && fm.isFileDownloaded(path)) {
      const collection = JSON.parse(fm.readString(path))
      savedCount = PCGeoJSON.isFeatureCollection(collection) ? collection.features.length : null
    }
  } catch (error) {
    savedCount = null
  }

  return { pendingCount: pending.length, savedCount }
}

module.exports = {
  collectionPath,
  queuePath,
  ensureDirectories,
  readQueue,
  writeQueue,
  enqueuePoint,
  readCollectionFromICloud,
  writeCollectionToICloud,
  addPoint,
  syncPending,
  getStatus
}
