const PCGeoJSON = require("../Scriptable/PCGeoJSON")

describe("createPointFeature", () => {
  it("builds a Point feature with 2D coordinates when altitude is omitted", () => {
    const feature = PCGeoJSON.createPointFeature({ latitude: 45.5, longitude: -122.6 })

    expect(feature.type).toBe("Feature")
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [-122.6, 45.5] })
    expect(feature.properties.id).toBe(feature.id)
    expect(typeof feature.properties.timestamp).toBe("string")
  })

  it("includes altitude as the third coordinate when provided", () => {
    const feature = PCGeoJSON.createPointFeature({ latitude: 1, longitude: 2, altitude: 3 })
    expect(feature.geometry.coordinates).toEqual([2, 1, 3])
  })

  it("carries through name and notes", () => {
    const feature = PCGeoJSON.createPointFeature({
      latitude: 1,
      longitude: 2,
      name: "Trailhead",
      notes: "Muddy"
    })
    expect(feature.properties.name).toBe("Trailhead")
    expect(feature.properties.notes).toBe("Muddy")
  })

  it("throws when latitude or longitude is missing or non-numeric", () => {
    expect(() => PCGeoJSON.createPointFeature({ latitude: "1", longitude: 2 })).toThrow()
    expect(() => PCGeoJSON.createPointFeature({ longitude: 2 })).toThrow()
  })
})

describe("mergeFeatureCollections", () => {
  it("appends new features to an empty base", () => {
    const feature = PCGeoJSON.createPointFeature({ latitude: 1, longitude: 2 })
    const merged = PCGeoJSON.mergeFeatureCollections(PCGeoJSON.emptyFeatureCollection(), [feature])
    expect(merged.features).toHaveLength(1)
    expect(merged.features[0]).toBe(feature)
  })

  it("falls back to an empty collection when base is not a valid FeatureCollection", () => {
    const feature = PCGeoJSON.createPointFeature({ latitude: 1, longitude: 2 })
    const merged = PCGeoJSON.mergeFeatureCollections(null, [feature])
    expect(merged).toEqual({ type: "FeatureCollection", features: [feature] })
  })

  it("does not duplicate features that already exist in the base by id", () => {
    const feature = PCGeoJSON.createPointFeature({ latitude: 1, longitude: 2 })
    const base = { type: "FeatureCollection", features: [feature] }
    const merged = PCGeoJSON.mergeFeatureCollections(base, [feature])
    expect(merged.features).toHaveLength(1)
  })

  it("merges multiple distinct queued features alongside existing ones", () => {
    const existing = PCGeoJSON.createPointFeature({ latitude: 1, longitude: 2 })
    const queuedA = PCGeoJSON.createPointFeature({ latitude: 3, longitude: 4 })
    const queuedB = PCGeoJSON.createPointFeature({ latitude: 5, longitude: 6 })
    const base = { type: "FeatureCollection", features: [existing] }

    const merged = PCGeoJSON.mergeFeatureCollections(base, [queuedA, queuedB])

    expect(merged.features).toHaveLength(3)
    expect(merged.features.map((f) => f.properties.id)).toEqual(
      expect.arrayContaining([existing.properties.id, queuedA.properties.id, queuedB.properties.id])
    )
  })

  it("treats a missing incomingFeatures argument as an empty list", () => {
    const merged = PCGeoJSON.mergeFeatureCollections(PCGeoJSON.emptyFeatureCollection())
    expect(merged.features).toEqual([])
  })
})

describe("isFeatureCollection", () => {
  it("accepts a well-formed FeatureCollection", () => {
    expect(PCGeoJSON.isFeatureCollection({ type: "FeatureCollection", features: [] })).toBe(true)
  })

  it("rejects non-FeatureCollection values", () => {
    expect(PCGeoJSON.isFeatureCollection(null)).toBe(false)
    expect(PCGeoJSON.isFeatureCollection({ type: "Feature" })).toBe(false)
    expect(PCGeoJSON.isFeatureCollection({ type: "FeatureCollection", features: "nope" })).toBe(false)
  })
})
