// PCTimeout.js
// Races a promise against a timer so a slow/hanging native call (a GPS fix,
// an iCloud download) can't block the script indefinitely — critical inside
// a widget refresh, which has a limited execution budget. Scriptable-only
// module: relies on the global `Timer` class.

function withTimeout(promise, seconds) {
  let timer
  const timeoutPromise = new Promise((resolve, reject) => {
    timer = Timer.schedule(seconds, false, () => reject(new Error(`Timed out after ${seconds}s`)))
  })
  return Promise.race([promise, timeoutPromise]).then(
    (value) => {
      if (timer) timer.invalidate()
      return value
    },
    (error) => {
      if (timer) timer.invalidate()
      throw error
    }
  )
}

module.exports = { withTimeout }
