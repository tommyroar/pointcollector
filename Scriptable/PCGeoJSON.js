// PCGeoJSON.js
// Pure GeoJSON helpers shared by the Point Collector Scriptable app.
// This module has no dependency on Scriptable-only globals, so it can be
// imported both by Scriptable (via importModule) and by plain Node.js (for
// the test suite in ../test).

function generateId() {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${time}-${rand}`
}

function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] }
}

function isFeatureCollection(value) {
  return !!value && value.type === "FeatureCollection" && Array.isArray(value.features)
}

function createPointFeature({
  latitude,
  longitude,
  altitude = null,
  horizontalAccuracy = null,
  verticalAccuracy = null,
  name = "",
  notes = "",
  timestamp = new Date().toISOString(),
  id = generateId()
}) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("createPointFeature requires numeric latitude and longitude")
  }

  const coordinates =
    altitude === null || altitude === undefined ? [longitude, latitude] : [longitude, latitude, altitude]

  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates },
    properties: {
      id,
      name: name || "",
      notes: notes || "",
      timestamp,
      horizontalAccuracy,
      verticalAccuracy
    }
  }
}

// Merges `incomingFeatures` into `base`, skipping any feature whose
// properties.id already exists in `base`. This lets a locally queued point
// be synced into the iCloud collection without creating duplicates if the
// same point is ever merged more than once.
function mergeFeatureCollections(base, incomingFeatures) {
  const safeBase = isFeatureCollection(base) ? base : emptyFeatureCollection()
  const existingIds = new Set(
    safeBase.features.map((feature) => feature && feature.properties && feature.properties.id).filter(Boolean)
  )

  const additions = (incomingFeatures || []).filter((feature) => {
    const id = feature && feature.properties && feature.properties.id
    return !id || !existingIds.has(id)
  })

  return { type: "FeatureCollection", features: [...safeBase.features, ...additions] }
}

module.exports = {
  generateId,
  emptyFeatureCollection,
  isFeatureCollection,
  createPointFeature,
  mergeFeatureCollections
}
