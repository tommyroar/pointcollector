// Variables used by Scriptable.
// icon-color: green; icon-glyph: satellite-dish;

// Point Collector Widget
//
// A home screen widget showing the last-known GPS reading (lat/long/
// altitude/horizontal accuracy) and how many points are still queued for
// sync. Add it to the home screen and point it at this script.
//
// iOS decides the actual refresh cadence for widgets — it's not a live,
// continuously-updating readout, typically every 15-30 minutes. Run the
// script directly (tap it in the Scriptable app) for an on-demand reading.

const PCLocation = importModule("PCLocation")
const PCStorage = importModule("PCStorage")

function addRow(widget, label, value) {
  const stack = widget.addStack()
  stack.layoutHorizontally()

  const labelText = stack.addText(`${label}:`)
  labelText.font = Font.systemFont(12)
  labelText.textColor = Color.gray()

  stack.addSpacer(6)

  const valueText = stack.addText(value)
  valueText.font = Font.mediumSystemFont(12)
  valueText.textColor = Color.white()
}

function relativeTime(isoTimestamp) {
  const seconds = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}

function formatNumber(value, digits, unit) {
  return typeof value === "number" ? `${value.toFixed(digits)}${unit}` : "—"
}

async function createWidget() {
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#1c1c1e")

  const family = config.widgetFamily || "medium"

  const title = widget.addText("Point Collector")
  title.font = Font.boldSystemFont(12)
  title.textColor = Color.green()
  widget.addSpacer(4)

  let result = null
  try {
    // Small accuracy target + short timeout: widgets have a limited
    // execution budget, so we favor a fast fix over a precise one and fall
    // back to the last cached reading (see PCLocation) on timeout.
    result = await PCLocation.getCurrentReading({ timeoutSeconds: 10, accuracy: "hundredMeters" })
  } catch (error) {
    result = null
  }

  if (!result) {
    const empty = widget.addText("No location yet")
    empty.font = Font.systemFont(12)
    empty.textColor = Color.gray()
  } else {
    const { reading, stale } = result
    addRow(widget, "Lat", formatNumber(reading.latitude, 6, ""))
    addRow(widget, "Long", formatNumber(reading.longitude, 6, ""))
    if (family !== "small") {
      addRow(widget, "Alt", formatNumber(reading.altitude, 1, " m"))
    }
    addRow(widget, "±", formatNumber(reading.horizontalAccuracy, 0, " m"))

    widget.addSpacer(4)
    const caption = widget.addText(`${stale ? "Last known" : "Updated"} · ${relativeTime(reading.timestamp)}`)
    caption.font = Font.systemFont(10)
    caption.textColor = Color.gray()
  }

  if (family !== "small") {
    try {
      const pending = PCStorage.readQueue().length
      if (pending > 0) {
        widget.addSpacer(4)
        const pendingText = widget.addText(`${pending} point(s) queued for sync`)
        pendingText.font = Font.systemFont(10)
        pendingText.textColor = Color.orange()
      }
    } catch (error) {
      // Pending count is a nice-to-have — don't fail the widget over it.
    }
  }

  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
  return widget
}

const widget = await createWidget()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
