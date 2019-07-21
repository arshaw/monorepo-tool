
let isEnabled = false


export function enableLogging() {
  isEnabled = true
}


export function log(...args: any[]) {
  if (isEnabled) {
    console.log(...args)
  }
}
