import fetchMock from "jest-fetch-mock"
fetchMock.enableMocks()
import { HttpClient } from "../src/http/httpClient"
import * as helpers from "../src/http/helpers"
import { TopicResult, BatchQueryResponse } from "../src/http/types"
import {
  HttpQueryError,
  HttpProcessingError,
  HttpServerError,
} from "../src/errors"

describe("HttpClient - JSON Operations", () => {
  let httpClient: HttpClient

  beforeEach(() => {
    fetchMock.resetMocks()
    httpClient = new HttpClient("http://fake-base-url")
    jest.restoreAllMocks()
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

    fetchMock.mockResponseOnce(JSON.stringify(mockResult))

    const makeObjectSpy = jest
      .spyOn(helpers, "makeObject")
      .mockImplementation(() => {
        return { child: { nested: true } }
      })

    const data = await httpClient.queryJson("json/parent")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const fetchOptions = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)

    expect(fetchOptions).toEqual({
      topic: "json/parent",
      depth: -1,
      flatten: false,
    })

    expect(data).toEqual({ child: { nested: true } })

    makeObjectSpy.mockRestore()
  })

  it("queryJsonBatch should handle multiple successful JSON queries", async () => {
    const makeObjectSpy = jest
      .spyOn(helpers, "makeObject")
      .mockImplementationOnce(() => ({ val: 1 }))
      .mockImplementationOnce(() => ({ child: "B" }))

    const queryBatchSpy = jest
      .spyOn(httpClient, "queryBatch")
      .mockResolvedValue([
        { topic: "json/a", payload: { val: 1 } },
        { topic: "json/b", payload: { child: "B" } },
      ])

    const topics = ["json/a", "json/b"]
    const results = await httpClient.queryJsonBatch(topics)

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ val: 1 })
    expect(results[1]).toEqual({ child: "B" })

    makeObjectSpy.mockRestore()
    queryBatchSpy.mockRestore()
  })

  it("queryJson should throw HttpQueryError for wildcards", async () => {
    await expect(httpClient.queryJson("wildcard/+")).rejects.toThrow(
      HttpQueryError,
    )
    await expect(httpClient.queryJson("wildcard/+")).rejects.toThrow(
      "Wildcards (+, #) are not supported in queryJson()",
    )
  })

  it("queryJson should throw HttpProcessingError if makeObject fails", async () => {
    const mockResult: TopicResult = {
      topic: "processing/fail",
      payload: "{}",
    }
    fetchMock.mockResponseOnce(JSON.stringify(mockResult))

    const customError = new HttpProcessingError(
      "Failed to construct JSON object: Simulated makeObject failure",
      { topic: "processing/fail" },
    )

    const makeObjectSpy = jest
      .spyOn(helpers, "makeObject")
      .mockImplementation(() => {
        throw customError
      })

    await expect(httpClient.queryJson("processing/fail")).rejects.toThrow(
      HttpProcessingError,
    )

    makeObjectSpy.mockRestore()
  })

  it("queryJsonBatch should return HttpQueryError if a topic has wildcards", async () => {
    await expect(
      httpClient.queryJsonBatch(["good/topic", "bad/+"]),
    ).rejects.toThrow(HttpQueryError)
  })

  it("queryJsonBatch should return specific errors for failed items", async () => {
    const mockBatchResponseForJsonBatch: BatchQueryResponse = [
      { topic: "json/ok", payload: JSON.stringify({ val: 1 }) },
      { topic: "json/serverErr", error: "Server rejected" },
      { topic: "json/makeObjErr", payload: JSON.stringify({}) },
    ]

    fetchMock.mockResponseOnce(JSON.stringify(mockBatchResponseForJsonBatch))

    const queryBatchSpy = jest
      .spyOn(httpClient, "queryBatch")
      .mockResolvedValue([
        { topic: "json/ok", payload: JSON.stringify({ val: 1 }) },
        new HttpServerError("json/serverErr", "Server rejected"),
        { topic: "json/makeObjErr", payload: JSON.stringify({}) },
      ])

    const makeObjectSpy = jest
      .spyOn(helpers, "makeObject")
      .mockImplementation((result: TopicResult) => {
        if (result.topic === "json/ok") {
          return { val: 1 }
        }
        if (result.topic === "json/makeObjErr") {
          throw new HttpProcessingError("makeObject failed test", {
            topic: result.topic,
          })
        }
        throw new Error("Unexpected call to makeObject")
      })

    const topics = ["json/ok", "json/serverErr", "json/makeObjErr"]
    const results = await httpClient.queryJsonBatch(topics)

    expect(results).toHaveLength(3)

    expect(results[0]).toEqual({ val: 1 })

    expect(results[1]).toBeInstanceOf(HttpServerError)
    expect((results[1] as HttpServerError).topic).toBe("json/serverErr")
    expect((results[1] as HttpServerError).serverError).toBe("Server rejected")
    expect(results[2]).toBeInstanceOf(HttpProcessingError)
    expect((results[2] as HttpProcessingError).topic).toBe("json/makeObjErr")
    expect((results[2] as HttpProcessingError).message).toContain(
      "makeObject failed test",
    )

    makeObjectSpy.mockRestore()
    queryBatchSpy.mockRestore()
  })
})
