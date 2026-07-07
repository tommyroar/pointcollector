// PCNetwork.js
// Connectivity check for the Point Collector Scriptable app.
// Scriptable-only module: relies on the global `Request` class, so it can't
// be exercised from the Node test suite.

// Downloading an iCloud file while offline can hang indefinitely, so we
// probe a tiny, fast endpoint with a short timeout first and treat any
// failure (no connection, DNS failure, timeout) as "offline".
async function isOnline(timeoutSeconds = 5) {
  try {
    const request = new Request("https://www.gstatic.com/generate_204")
    request.method = "GET"
    request.timeoutInterval = timeoutSeconds
    await request.load()
    return true
  } catch (error) {
    return false
  }
}

module.exports = { isOnline }
