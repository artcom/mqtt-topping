import { IClientOptions, Packet } from "mqtt"
import { ClientOptions, ParseErrorCallback, SubscriptionHandler } from "./types"
import { KEEP_ALIVE, CONNECT_TIMEOUT } from "../defaults"
import { InvalidTopicError } from "../errors"
import { bufferToString, errorMessage } from "../utils"

export function matchTopic(subscription: string): (topic: string) => boolean {
  if (typeof subscription !== "string" || subscription.length === 0) {
    return () => false
  }

  const subLevels = subscription.split("/")
  const subLen = subLevels.length
  const lastSubLevel = subLevels[subLen - 1]

  const hasHash = lastSubLevel === "#"
  const hasPlus = subscription.includes("+")
  const hasWildcards = hasHash || hasPlus

  const comparisonEndIndex = hasHash ? subLen - 1 : subLen

  return (topic: string): boolean => {
    if (typeof topic !== "string" || topic.length === 0) {
      return false
    }

    if (subscription === topic) {
      return true
    }

    if (!hasWildcards) {
      return false
    }

    const topLevels = topic.split("/")

    for (let i = 0; i < comparisonEndIndex; i++) {
      const sub = subLevels[i]
      const top = topLevels[i]
      if (top === undefined) return false
      if (sub !== "+" && sub !== top) return false
    }

    if (hasHash) {
      return topLevels.length >= subLevels.length - 1
    }
    return subLevels.length === topLevels.length && !topLevels.includes("")
  }
}

type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: SyntaxError | null }

export function parsePayload(payload: Buffer | Uint8Array): ParseResult {
  if (payload == null) {
    return { ok: false, error: null }
  }
  if (payload.length === 0) {
    return { ok: true, value: undefined }
  }
  try {
    return { ok: true, value: JSON.parse(bufferToString(payload)) }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof SyntaxError
          ? error
          : new SyntaxError(`Unexpected parsing issue: ${errorMessage(error)}`),
    }
  }
}

export function isEventOrCommand(topic: string): boolean {
  if (!topic || typeof topic !== "string") {
    return false
  }
  const lastSlashIndex = topic.lastIndexOf("/")
  const lastTopicLevel =
    lastSlashIndex >= 0 ? topic.substring(lastSlashIndex + 1) : topic
  if (lastTopicLevel.length <= 2) {
    return false
  }
  const prefix = lastTopicLevel.substring(0, 2)
  const thirdChar = lastTopicLevel.charAt(2)
  return (
    (prefix === "on" || prefix === "do") && thirdChar >= "A" && thirdChar <= "Z"
  )
}

export function createClientId(appId?: string, deviceId?: string): string {
  const app = appId || "UnknownApp"
  const uuid = Math.random().toString(16).substring(2, 10)
  return deviceId ? `${app}-${deviceId}-${uuid}` : `${app}-${uuid}`
}

export function processOptions(options: ClientOptions): {
  finalOptions: IClientOptions
  onParseError?: ParseErrorCallback
} {
  const {
    appId,
    deviceId,
    clientId,
    will,
    onParseError,
    keepalive,
    connectTimeout,
    ...rest
  } = options
  const finalOptions: IClientOptions = {
    ...rest,
    clientId: clientId || createClientId(appId, deviceId),
    keepalive: keepalive ?? KEEP_ALIVE,
    connectTimeout: connectTimeout ?? CONNECT_TIMEOUT,
    will: processWillMessage(will),
  }
  return { finalOptions, onParseError }
}

function processWillMessage(
  will?: ClientOptions["will"],
): IClientOptions["will"] {
  if (!will) {
    return undefined
  }
  if (will.stringifyJson !== false && typeof will.payload !== "string") {
    try {
      return {
        ...will,
        payload: JSON.stringify(will.payload),
      }
    } catch {
      return {
        ...will,
        payload: String(will.payload),
      }
    }
  }
  return will
}

export function validateTopic(topic: string): void {
  if (!topic || typeof topic !== "string") {
    throw new InvalidTopicError("topic must be a non-empty string")
  }
  if (topic.includes("\u0000")) {
    throw new InvalidTopicError(
      "topic must not contain null characters (\\u0000)",
    )
  }
  if (topic.includes("#") && !topic.endsWith("/#") && topic !== "#") {
    throw new InvalidTopicError(
      "wildcard '#' must occupy an entire level and be the last character (e.g., 'foo/#' or '#')",
    )
  }

  const parts = topic.split("/")
  for (const part of parts) {
    if (part !== "+" && part.includes("+")) {
      throw new InvalidTopicError(
        "wildcard '+' must occupy an entire level (e.g., 'foo/+/bar')",
      )
    }
    if (part.length === 0 && topic !== "/" && topic !== "") {
      throw new InvalidTopicError(
        "topic must not contain empty levels (e.g., 'foo//bar')",
      )
    }
  }
}

export function validateTopicForPublish(topic: string): void {
  validateTopic(topic) // First validate general topic format
  if (topic.includes("#") || topic.includes("+")) {
    throw new InvalidTopicError(
      "publishing to wildcard topics ('#' or '+') is not allowed",
    )
  }
}

export function processHandlersForTopic(
  subscription: { handlers: SubscriptionHandler[] },
  topic: string,
  payload: Buffer | Uint8Array,
  packet: Packet,
): Error | null {
  let firstParsingError: Error | null = null

  for (const { callback, parseType, customParser } of subscription.handlers) {
    try {
      switch (parseType) {
        case "buffer":
          callback(payload, topic, packet)
          break
        case "string":
          callback(bufferToString(payload), topic, packet)
          break
        case "custom":
          try {
            if (customParser) {
              const parsed = customParser(payload)
              callback(parsed, topic, packet)
            } else {
              callback(payload, topic, packet)
            }
          } catch (customError) {
            if (!firstParsingError) {
              firstParsingError =
                customError instanceof Error
                  ? customError
                  : new Error(String(customError))
            }
          }
          break
        case "json":
        default: {
          const result = parsePayload(payload)
          if (result.ok) {
            callback(result.value, topic, packet)
          } else if (result.error && !firstParsingError) {
            firstParsingError = result.error
          }
        }
      }
    } catch {
      // Callback errors are the consumer's responsibility.
      // Swallow to prevent one handler from breaking others.
    }
  }

  return firstParsingError
}
