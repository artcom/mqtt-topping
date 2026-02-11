export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function bufferToString(payload: Buffer | Uint8Array): string {
  return typeof Buffer !== "undefined" && Buffer.isBuffer(payload)
    ? payload.toString()
    : new TextDecoder().decode(payload)
}
