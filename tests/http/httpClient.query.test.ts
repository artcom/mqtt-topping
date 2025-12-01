import fetchMock from "jest-fetch-mock"
fetchMock.enableMocks()
import { HttpClient } from "../../src/http/httpClient"
import * as helpers from "../../src/http/helpers"
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
import { HTTP_REQUEST_TIMEOUT } from "../../src/defaults"

describe("HttpClient - Query Operations", () => {
  let httpClient: HttpClient

  beforeEach(() => {
    fetchMock.resetMocks()
    httpClient = new HttpClient("http://fake-base-url")
    jest.restoreAllMocks()
  })

  it("query should call fetch and parse valid JSON response", async () => {
    const mockResponse: TopicResult = {
      topic: "mock/topic",
      payload: JSON.stringify({ foo: "bar" }),
    }
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse))

    const query: Query = { topic: "mock/topic", parseJson: true }
    const result = await httpClient.query(query)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("http://fake-base-url/query")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toEqual({
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
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse))

    const query: Query = { topic: "mock/topic/raw", parseJson: false }
    const result = await httpClient.query(query)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
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
    fetchMock.mockResponseOnce(JSON.stringify(mockBatchResponse))

    const queries: Query[] = [
      { topic: "batch/one", parseJson: true },
      { topic: "batch/two/flat", flatten: true, parseJson: true },
    ]
    const results = await httpClient.queryBatch(queries)

    expect(fetchMock).toHaveBeenCalledTimes(1)
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

    const postSpy = jest.spyOn(helpers, "post").mockImplementation(() => {
      throw new HttpRequestError(
        "http://fake-base-url/query",
        404,
        "Not Found",
        serverError,
      )
    })

    const query: Query = { topic: "nonexistent" }
    await expect(httpClient.query(query)).rejects.toThrow(HttpRequestError)

    try {
      await httpClient.query(query)
    } catch (error) {
      expect(error).toBeInstanceOf(HttpRequestError)
      const httpError = error as HttpRequestError
      expect(httpError.statusCode).toBe(404)
      expect(httpError.url).toBe("http://fake-base-url/query")
      expect(httpError.responseBody).toEqual(serverError)
      expect(httpError.message).toContain("Status 404 - Not Found")
    }

    postSpy.mockRestore()
  })

  it("query should throw HttpTimeoutError on timeout", async () => {
    const postSpy = jest.spyOn(helpers, "post").mockImplementation(() => {
      throw new HttpTimeoutError(
        "http://fake-base-url/query",
        HTTP_REQUEST_TIMEOUT,
        {
          cause: new Error("AbortError: The operation was aborted"),
        },
      )
    })

    const query: Query = { topic: "timeout/topic" }
    await expect(httpClient.query(query)).rejects.toThrow(HttpTimeoutError)

    try {
      await httpClient.query(query)
    } catch (error) {
      expect(error).toBeInstanceOf(HttpTimeoutError)
      const timeoutError = error as HttpTimeoutError
      expect(timeoutError.url).toBe("http://fake-base-url/query")
      expect(timeoutError.message).toContain(
        `timed out after ${HTTP_REQUEST_TIMEOUT}ms`,
      )
    }

    postSpy.mockRestore()
  })

  it("query should throw HttpNetworkError on fetch network failure", async () => {
    const postSpy = jest.spyOn(helpers, "post").mockImplementation(() => {
      throw new HttpNetworkError(
        "http://fake-base-url/query",
        "Failed to fetch",
        { cause: new TypeError("Failed to fetch") },
      )
    })

    const query: Query = { topic: "network/error" }
    await expect(httpClient.query(query)).rejects.toThrow(HttpNetworkError)

    try {
      await httpClient.query(query)
    } catch (error) {
      expect(error).toBeInstanceOf(HttpNetworkError)
      const networkError = error as HttpNetworkError
      expect(networkError.url).toBe("http://fake-base-url/query")
      expect(networkError.message).toContain("Failed to fetch")
      expect(networkError.cause).toBeInstanceOf(TypeError)
    }

    postSpy.mockRestore()
  })

  it("query should throw HttpPayloadParseError if response JSON is invalid", async () => {
    fetchMock.mockResponseOnce("{invalid json string", { status: 200 })

    const query: Query = { topic: "bad/response" }
    await expect(httpClient.query(query)).rejects.toThrow(HttpPayloadParseError)

    try {
      await httpClient.query(query)
    } catch (e) {
      expect(e).toBeInstanceOf(HttpPayloadParseError)
      expect((e as HttpPayloadParseError).message).toContain(
        "Failed to parse successful response body",
      )
    }
  })

  it("query should throw HttpPayloadParseError if payload parsing fails (when parseJson=true)", async () => {
    const mockResponse: TopicResult = {
      topic: "parse/fail",
      payload: "{invalid json payload",
    }
    fetchMock.mockResponseOnce(JSON.stringify(mockResponse), { status: 200 })

    const customError = new HttpPayloadParseError(
      "Failed to parse JSON payload: Unexpected token i in JSON at position 1",
      { topic: "parse/fail" },
    )

    const parsePayloadsSpy = jest
      .spyOn(helpers, "parsePayloads")
      .mockImplementation(() => {
        throw customError
      })

    const query: Query = { topic: "parse/fail", parseJson: true }
    await expect(httpClient.query(query)).rejects.toThrow(HttpPayloadParseError)

    try {
      await httpClient.query(query)
    } catch (e) {
      expect(e).toBeInstanceOf(HttpPayloadParseError)
    }

    parsePayloadsSpy.mockRestore()
  })

  it("queryBatch should return HttpServerError for server-reported errors in batch items", async () => {
    const mockBatchResponse: BatchQueryResponse = [
      { topic: "ok/topic", payload: "{}" },
      {
        topic: "fail/topic",
        error: { message: "Device offline", code: 503 },
      } as ErrorResult,
    ]
    fetchMock.mockResponseOnce(JSON.stringify(mockBatchResponse))

    const parsePayloadsSpy = jest
      .spyOn(helpers, "parsePayloads")
      .mockImplementation((result) => {
        if (!Array.isArray(result) && result && result.topic === "ok/topic") {
          result.payload = {}
        }
      })

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

    parsePayloadsSpy.mockRestore()
  })

  it("queryBatch should return HttpPayloadParseError for items that fail client-side parsing", async () => {
    const mockBatchResponse: BatchQueryResponse = [
      { topic: "good/parse", payload: '{"a": 1}' },
      { topic: "bad/parse", payload: "{invalid payload" },
    ]
    fetchMock.mockResponseOnce(JSON.stringify(mockBatchResponse))

    const parsePayloadsSpy = jest
      .spyOn(helpers, "parsePayloads")
      .mockImplementation((result) => {
        if (Array.isArray(result)) return

        if (!Array.isArray(result) && result && result.topic === "good/parse") {
          result.payload = { a: 1 }
          return
        }

        if (!Array.isArray(result) && result && result.topic === "bad/parse") {
          throw new HttpPayloadParseError(
            "Failed to parse JSON payload: Unexpected token i in JSON at position 1",
            { topic: "bad/parse" },
          )
        }
      })

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

    parsePayloadsSpy.mockRestore()
  })

  it("should use custom request timeout when configured", async () => {
    const customTimeout = 5000
    const customHttpClient = new HttpClient("http://fake-base-url", {
      requestTimeoutMs: customTimeout,
    })

    const postSpy = jest.spyOn(helpers, "post").mockImplementation(() => {
      throw new HttpTimeoutError("http://fake-base-url/query", customTimeout, {
        cause: new Error("AbortError: The operation was aborted"),
      })
    })

    const query: Query = { topic: "custom/timeout" }

    try {
      await customHttpClient.query(query)
    } catch (error) {
      expect(error).toBeInstanceOf(HttpTimeoutError)
      const timeoutError = error as HttpTimeoutError
      expect(timeoutError.message).toContain(
        `timed out after ${customTimeout}ms`,
      )
    }

    // Verify that post was called with the custom timeout
    expect(postSpy).toHaveBeenCalledWith(
      "http://fake-base-url",
      "/query",
      { topic: "custom/timeout" },
      customTimeout,
    )

    postSpy.mockRestore()
  })
})
