import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import { HttpClient } from "../../src/http/httpClient"
import {
  Query,
  TopicResult,
  BatchQueryResponse,
  ErrorResult,
} from "../../src/http/types"
import {
  HttpPayloadParseError,
  HttpRequestError,
  HttpTimeoutError,
  HttpNetworkError,
  HttpServerError,
} from "../../src/errors"

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init)

// Never settles on its own — rejects only once the request's own
// AbortSignal.timeout() fires, exactly as a hanging connection would.
const hangUntilAborted = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(init.signal?.reason)
    })
  })

describe("HttpClient - Query Operations", () => {
  let fetchSpy: jest.Spied<typeof fetch>
  let httpClient: HttpClient

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch")
    httpClient = new HttpClient("http://fake-base-url")
  })

  it("query should call fetch and parse valid JSON response", async () => {
    const mockResponse: TopicResult = {
      topic: "mock/topic",
      payload: JSON.stringify({ foo: "bar" }),
    }
    fetchSpy.mockResolvedValueOnce(jsonResponse(mockResponse))

    const query: Query = { topic: "mock/topic", parseJson: true }
    const result = await httpClient.query(query)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe("http://fake-base-url/query")
    expect(init?.method).toBe("POST")
    expect(JSON.parse(String(init?.body))).toEqual({
      topic: "mock/topic",
    })

    expect(result).toEqual({
      topic: "mock/topic",
      payload: { foo: "bar" },
    })
  })

  it("query should call fetch and return unparsed response if parseJson is false", async () => {
    const mockResponse: TopicResult = {
      topic: "mock/topic/raw",
      payload: JSON.stringify({ foo: "bar" }),
    }
    fetchSpy.mockResolvedValueOnce(jsonResponse(mockResponse))

    const query: Query = { topic: "mock/topic/raw", parseJson: false }
    const result = await httpClient.query(query)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      topic: "mock/topic/raw",
    })

    expect(result).toEqual({
      topic: "mock/topic/raw",
      payload: JSON.stringify({ foo: "bar" }),
    })
  })

  it("queryBatch should handle multiple successful responses with parsing", async () => {
    const mockBatchResponse: BatchQueryResponse = [
      {
        topic: "batch/one",
        payload: JSON.stringify({ success: true }),
      },
      [
        {
          topic: "batch/two/flat",
          payload: JSON.stringify({ value: 123 }),
        },
      ],
    ]
    fetchSpy.mockResolvedValueOnce(jsonResponse(mockBatchResponse))

    const queries: Query[] = [
      { topic: "batch/one", parseJson: true },
      { topic: "batch/two/flat", flatten: true, parseJson: true },
    ]
    const results = await httpClient.queryBatch(queries)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(2)

    expect(results[0]).toEqual({
      topic: "batch/one",
      payload: { success: true },
    })
    expect(results[1]).toEqual([
      {
        topic: "batch/two/flat",
        payload: { value: 123 },
      },
    ])
  })

  it("query should throw HttpRequestError on non-OK response", async () => {
    const serverError = { code: "INVALID_TOPIC", message: "Topic not found" }
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(serverError, { status: 404, statusText: "Not Found" }),
    )

    const failed = httpClient.query({ topic: "nonexistent" })

    await expect(failed).rejects.toThrow(HttpRequestError)
    await expect(failed).rejects.toMatchObject({
      statusCode: 404,
      url: "http://fake-base-url/query",
      message: expect.stringContaining("Status 404 - Not Found"),
    })
    await expect(failed).rejects.toHaveProperty("responseBody", serverError)
  })

  it("query should throw HttpTimeoutError on timeout", async () => {
    const timeoutClient = new HttpClient("http://fake-base-url", {
      requestTimeoutMs: 5,
    })
    fetchSpy.mockImplementationOnce(hangUntilAborted)

    const failed = timeoutClient.query({ topic: "timeout/topic" })

    await expect(failed).rejects.toThrow(HttpTimeoutError)
    await expect(failed).rejects.toMatchObject({
      url: "http://fake-base-url/query",
      message: expect.stringContaining("timed out after 5ms"),
    })
    // the real AbortSignal.timeout() reason, not a hand-made error
    await expect(failed).rejects.toHaveProperty("cause.name", "TimeoutError")
  })

  it("query should throw HttpNetworkError on fetch network failure", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"))

    const failed = httpClient.query({ topic: "network/error" })

    await expect(failed).rejects.toThrow(HttpNetworkError)
    await expect(failed).rejects.toMatchObject({
      url: "http://fake-base-url/query",
      message: expect.stringContaining("fetch failed"),
      cause: expect.any(TypeError),
    })
  })

  it("query should throw HttpPayloadParseError if response JSON is invalid", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("{invalid json string", { status: 200 }),
    )

    const failed = httpClient.query({ topic: "bad/response" })

    await expect(failed).rejects.toThrow(HttpPayloadParseError)
    await expect(failed).rejects.toThrow(
      /Failed to parse successful response body/,
    )
  })

  it("query should throw HttpPayloadParseError if payload parsing fails (when parseJson=true)", async () => {
    const mockResponse: TopicResult = {
      topic: "parse/fail",
      payload: "{invalid json payload",
    }
    fetchSpy.mockResolvedValueOnce(jsonResponse(mockResponse, { status: 200 }))

    const failed = httpClient.query({ topic: "parse/fail", parseJson: true })

    await expect(failed).rejects.toThrow(HttpPayloadParseError)
    await expect(failed).rejects.toMatchObject({
      topic: "parse/fail",
      message: expect.stringContaining("Failed to parse JSON payload"),
    })
  })

  it("queryBatch should return HttpServerError for server-reported errors in batch items", async () => {
    const mockBatchResponse: BatchQueryResponse = [
      { topic: "ok/topic", payload: "{}" },
      {
        topic: "fail/topic",
        error: { message: "Device offline", code: 503 },
      } as ErrorResult,
    ]
    fetchSpy.mockResolvedValueOnce(jsonResponse(mockBatchResponse))

    const queries: Query[] = [{ topic: "ok/topic" }, { topic: "fail/topic" }]
    const results = await httpClient.queryBatch(queries)

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ topic: "ok/topic", payload: {} })

    expect(results[1]).toBeInstanceOf(HttpServerError)
    const serverError = results[1] as HttpServerError
    expect(serverError.topic).toBe("fail/topic")
    expect(serverError.serverError).toEqual({
      message: "Device offline",
      code: 503,
    })
    expect(serverError.message).toContain(
      'Server reported error for topic "fail/topic": Device offline',
    )
  })

  it("queryBatch should return HttpPayloadParseError for items that fail client-side parsing", async () => {
    const mockBatchResponse: BatchQueryResponse = [
      { topic: "good/parse", payload: '{"a": 1}' },
      { topic: "bad/parse", payload: "{invalid payload" },
    ]
    fetchSpy.mockResolvedValueOnce(jsonResponse(mockBatchResponse))

    const queries: Query[] = [
      { topic: "good/parse", parseJson: true },
      { topic: "bad/parse", parseJson: true },
    ]
    const results = await httpClient.queryBatch(queries)

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ topic: "good/parse", payload: { a: 1 } })

    expect(results[1]).toBeInstanceOf(HttpPayloadParseError)
    const parseError = results[1] as HttpPayloadParseError
    expect(parseError.topic).toBe("bad/parse")
    expect(parseError.message).toContain("Failed to parse JSON payload")
  })

  it("should use custom request timeout when configured", async () => {
    const customTimeout = 25
    const customHttpClient = new HttpClient("http://fake-base-url", {
      requestTimeoutMs: customTimeout,
    })
    fetchSpy.mockImplementationOnce(hangUntilAborted)

    const failed = customHttpClient.query({ topic: "custom/timeout" })

    await expect(failed).rejects.toThrow(HttpTimeoutError)
    await expect(failed).rejects.toThrow(`timed out after ${customTimeout}ms`)
  })
})
