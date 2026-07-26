import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import { HttpClient } from "../../src/http/httpClient"
import { TopicResult, BatchQueryResponse } from "../../src/http/types"
import {
  HttpQueryError,
  HttpProcessingError,
  HttpServerError,
} from "../../src/errors"

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init)

describe("HttpClient - JSON Operations", () => {
  let fetchSpy: jest.Spied<typeof fetch>
  let httpClient: HttpClient

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch")
    httpClient = new HttpClient("http://fake-base-url")
  })

  it("queryJson should fetch, parse, and build object", async () => {
    const mockResult: TopicResult = {
      topic: "json/parent",
      payload: "{}",
      children: [
        {
          topic: "json/parent/child",
          payload: JSON.stringify({ nested: true }),
        },
      ],
    }

    fetchSpy.mockResolvedValueOnce(jsonResponse(mockResult))

    const data = await httpClient.queryJson("json/parent")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))

    expect(requestBody).toEqual({
      topic: "json/parent",
      depth: -1,
      flatten: false,
    })

    expect(data).toEqual({ child: { nested: true } })
  })

  it("queryJsonBatch should handle multiple successful JSON queries", async () => {
    const mockBatchResponse: BatchQueryResponse = [
      { topic: "json/a", payload: JSON.stringify({ val: 1 }) },
      { topic: "json/b", payload: JSON.stringify({ child: "B" }) },
    ]
    fetchSpy.mockResolvedValueOnce(jsonResponse(mockBatchResponse))

    const topics = ["json/a", "json/b"]
    const results = await httpClient.queryJsonBatch(topics)

    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual([
      { topic: "json/a", depth: -1, flatten: false },
      { topic: "json/b", depth: -1, flatten: false },
    ])

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ val: 1 })
    expect(results[1]).toEqual({ child: "B" })
  })

  it("queryJson should throw HttpQueryError for wildcards", async () => {
    await expect(httpClient.queryJson("wildcard/+")).rejects.toThrow(
      HttpQueryError,
    )
    await expect(httpClient.queryJson("wildcard/+")).rejects.toThrow(
      "Wildcards (+, #) are not supported in queryJson()",
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("queryJson should throw HttpProcessingError for an unexpected array result", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse([{ topic: "processing/fail", payload: "{}" }]),
    )

    let failure: unknown
    try {
      await httpClient.queryJson("processing/fail")
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(HttpProcessingError)
    const processingError = failure as HttpProcessingError
    expect(processingError.topic).toBe("processing/fail")
    expect(processingError.message).toContain("Unexpected array result")
  })

  it("queryJsonBatch should return HttpQueryError if a topic has wildcards", async () => {
    await expect(
      httpClient.queryJsonBatch(["good/topic", "bad/+"]),
    ).rejects.toThrow(HttpQueryError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("queryJsonBatch should return specific errors for failed items", async () => {
    const mockBatchResponse: BatchQueryResponse = [
      { topic: "json/ok", payload: JSON.stringify({ val: 1 }) },
      { topic: "json/serverErr", error: "Server rejected" },
      [{ topic: "json/arrayErr", payload: JSON.stringify({}) }],
    ]

    fetchSpy.mockResolvedValueOnce(jsonResponse(mockBatchResponse))

    const topics = ["json/ok", "json/serverErr", "json/arrayErr"]
    const results = await httpClient.queryJsonBatch(topics)

    expect(results).toHaveLength(3)

    expect(results[0]).toEqual({ val: 1 })

    expect(results[1]).toBeInstanceOf(HttpServerError)
    expect((results[1] as HttpServerError).topic).toBe("json/serverErr")
    expect((results[1] as HttpServerError).serverError).toBe("Server rejected")

    expect(results[2]).toBeInstanceOf(HttpProcessingError)
    expect((results[2] as HttpProcessingError).topic).toBe("json/arrayErr")
    expect((results[2] as HttpProcessingError).message).toContain(
      "Unexpected array result in queryJsonBatch",
    )
  })

  it("queryJson should parse nested JSON string payloads into objects", async () => {
    // Mock the raw server response with JSON string payloads
    const mockResult: TopicResult = {
      topic: "json/sample",
      children: [
        {
          topic: "json/sample/data",
          payload: JSON.stringify({
            array: ["a", "b", "c"],
            nested1: {
              one: 1,
              two: 2,
            },
            nested2: {
              one: 10,
            },
            nested3: {
              one: 100,
            },
            string: "bar",
          }),
        },
        {
          topic: "json/sample/paths",
          payload: JSON.stringify({
            state: "status/main",
            message: "events/update",
            command: "commands/toggle",
          }),
        },
      ],
    }

    fetchSpy.mockResolvedValueOnce(jsonResponse(mockResult))

    const data = await httpClient.queryJson("json/sample")

    // Verify that nested payloads are parsed as objects, not strings
    expect(data).toEqual({
      data: {
        array: ["a", "b", "c"],
        nested1: {
          one: 1,
          two: 2,
        },
        nested2: {
          one: 10,
        },
        nested3: {
          one: 100,
        },
        string: "bar",
      },
      paths: {
        state: "status/main",
        message: "events/update",
        command: "commands/toggle",
      },
    })

    // Verify the nested objects are actual objects, not JSON strings
    const dataAsRecord = data as Record<string, unknown>
    expect(typeof dataAsRecord.data).toBe("object")
    expect(typeof dataAsRecord.paths).toBe("object")

    const dataNode = dataAsRecord.data as Record<string, unknown>
    const pathsNode = dataAsRecord.paths as Record<string, unknown>
    expect(Array.isArray(dataNode.array)).toBe(true)
    expect(typeof pathsNode.state).toBe("string")
  })
})
