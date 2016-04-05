export function waitFor(condition, timeout = 2000) {
  return new Promise((resolve, reject) => {
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
}
