import { Query, TopicResult, FlatTopicResult } from "./types"

import {
  HttpError,
  HttpNetworkError,
  HttpTimeoutError,
  HttpRequestError,
  HttpQueryError,
  HttpPayloadParseError,
  HttpProcessingError,
} from "../errors"
import { bufferToString, errorMessage } from "../utils"

/* eslint-disable @typescript-eslint/no-unused-vars */
export function omitParseJson({
  parseJson,
  ...rest
}: Query): Omit<Query, "parseJson"> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return rest
}

export function makeJsonQuery(topic: string): Query {
  if (topic.includes("+") || topic.includes("#")) {
    throw new HttpQueryError(
      "Wildcards (+, #) are not supported in queryJson()",
      { query: topic },
    )
  }
  return { topic, depth: -1, flatten: false, parseJson: false }
}

export function makeObject(result: TopicResult): unknown {
  try {
    if (result.children && result.children.length > 0) {
      const obj: Record<string, unknown> = {}
      result.children.forEach((child) => {
        let key = ""
        if (result.topic === "/") {
          key = child.topic.substring(1).split("/")[0]
        } else if (child.topic.startsWith(result.topic + "/")) {
          key = child.topic.substring(result.topic.length + 1).split("/")[0]
        } else {
          key = child.topic.split("/").pop() || child.topic
        }

        if (key) {
          obj[key] = makeObject(child)
        }
      })

      return obj
    }

    return result.payload as unknown
  } catch (error) {
    throw new HttpProcessingError(
      `Failed to construct JSON object for topic ${result.topic}: ${errorMessage(error)}`,
      { cause: error, topic: result.topic },
    )
  }
}

export function parsePayloads(
  result: TopicResult | FlatTopicResult[] | undefined | null,
  topicForErrorContext?: string,
): void {
  if (!result) return

  const baseTopic =
    topicForErrorContext ??
    (typeof result === "object" && "topic" in result ? result.topic : "unknown")

  try {
    if (Array.isArray(result)) {
      result.forEach((item) => parsePayloads(item, item.topic))
      return
    }

    parsePayload(result)

    if ("children" in result && result.children) {
      result.children.forEach((child) => parsePayloads(child, child.topic))
    }
  } catch (error) {
    if (error instanceof HttpPayloadParseError && !error.topic) {
      // Create a new error with the topic included instead of modifying read-only property
      throw new HttpPayloadParseError(error.message, {
        cause: error.cause,
        topic: baseTopic,
      })
    } else if (!(error instanceof HttpError)) {
      throw new HttpProcessingError(
        `Error processing payloads for topic ${baseTopic}: ${errorMessage(error)}`,
        { cause: error, topic: baseTopic },
      )
    }
    throw error
  }
}

export function parsePayload(result: TopicResult | FlatTopicResult): void {
  if (result.payload == null) {
    return
  }

  let payloadStr: string | undefined

  try {
    if (typeof result.payload === "string") {
      payloadStr = result.payload
    } else if (result.payload instanceof Uint8Array) {
      payloadStr = bufferToString(result.payload as Buffer | Uint8Array)
    } else if (typeof result.payload === "object") {
      return
    } else {
      payloadStr = String(result.payload)
    }

    if (payloadStr !== undefined) {
      if (payloadStr.trim() === "") {
        result.payload = null
        return
      }
      result.payload = JSON.parse(payloadStr)
    }
  } catch (error) {
    throw new HttpPayloadParseError(
      `Failed to parse JSON payload: ${errorMessage(error)}`,
      { cause: error, topic: result.topic },
    )
  }
}

export async function post<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const url = `${baseUrl}${path}`

  let response: Response | undefined

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      let errorPayload: unknown = `${response.status} ${response.statusText}`
      try {
        errorPayload = await response.json()
      } catch {
        // Failed to parse JSON, try text instead
        try {
          errorPayload = await response.text()
          if (!errorPayload) {
            errorPayload = `${response.status} ${response.statusText}`
          }
        } catch {
          // Unable to get text response
        }
      }

      throw new HttpRequestError(
        url,
        response.status,
        response.statusText,
        errorPayload,
      )
    }

    try {
      return (await response.json()) as T
    } catch (parseError) {
      throw new HttpPayloadParseError(
        `Failed to parse successful response body from ${url}: ${errorMessage(parseError)}`,
        { cause: parseError },
      )
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new HttpTimeoutError(url, timeoutMs, { cause: error })
      }
      if (
        error instanceof SyntaxError &&
        error.message.includes("JSON.stringify")
      ) {
        throw new HttpQueryError(
          `Failed to stringify request body: ${error.message}`,
          { cause: error, query: body },
        )
      }
    }

    throw new HttpNetworkError(url, errorMessage(error), { cause: error })
  }
}
