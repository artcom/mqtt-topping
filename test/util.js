module.exports.delayUntil = (condition, timeout = 2000) =>
  new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start

      if (elapsed > timeout) {
        clearInterval(interval)
        reject(new Error("Timeout"))
      } else if (condition()) {
        clearInterval(interval)
        resolve()
      }
    }, 20)
  })

module.exports.delay = (time) => new Promise((resolve) => setTimeout(() => resolve(), time))
