import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals"
import { MqttClient, type TopicQuerier } from "../../src"
import { asMock, type MockMqttClient } from "../../__mocks__/mqtt"
import type { HttpClient } from "../../src/http/httpClient"
import { FlatTopicResult } from "../../src/http/types"

describe("MqttClient - Recursive Unpublish", () => {
  let mock: MockMqttClient
  let client: MqttClient
  let httpStub: { query: jest.Mock<HttpClient["query"]> }

  beforeEach(async () => {
    client = await MqttClient.connect("mqtt://dummy")
    mock = asMock(client.underlyingClient)

    httpStub = { query: jest.fn<HttpClient["query"]>() } satisfies TopicQuerier
  })

  // restoreMocks does not cover timers
  afterEach(() => {
    jest.useRealTimers()
  })

  it("should unpublish all discovered topics", async () => {
    const topics = ["root/topic", "root/topic/sub1", "root/topic/sub2"]
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))

    httpStub.query.mockResolvedValue(flatResults)

    await client.unpublishRecursively("root/topic", httpStub)

    expect(httpStub.query).toHaveBeenCalledWith({
      topic: "root/topic",
      depth: -1,
      flatten: true,
      parseJson: false,
    })

    expect(mock.publishAsync).toHaveBeenCalledTimes(3)

    // Verify all topics were unpublished
    const calls = mock.publishAsync.mock.calls
    const unpublishedTopics = calls.map((call) => call[0])
    expect(unpublishedTopics).toEqual(expect.arrayContaining(topics))

    // Verify unpublish payload (empty string, retained)
    calls.forEach((call) => {
      expect(call[1].toString()).toBe("")
      expect(call[2]).toMatchObject({ retain: true })
    })
  })

  it("should do nothing if no topics found", async () => {
    httpStub.query.mockResolvedValue([])

    await client.unpublishRecursively("root/empty", httpStub)

    expect(mock.publishAsync).not.toHaveBeenCalled()
  })

  it("should batch unpublish calls", async () => {
    jest.useFakeTimers()

    const topics = Array.from({ length: 15 }, (_, i) => `topic/${i}`)
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))
    httpStub.query.mockResolvedValue(flatResults)

    const batchSize = 5
    const done = client.unpublishRecursively("root", httpStub, { batchSize })

    // batch 1 goes out immediately, the rest wait for the default 10ms delay
    await jest.advanceTimersByTimeAsync(0)
    expect(mock.publishAsync).toHaveBeenCalledTimes(5)

    await jest.advanceTimersByTimeAsync(10)
    expect(mock.publishAsync).toHaveBeenCalledTimes(10)

    await jest.advanceTimersByTimeAsync(10)
    await done

    expect(mock.publishAsync).toHaveBeenCalledTimes(15)
  })

  it("should throttle unpublish calls", async () => {
    jest.useFakeTimers()

    const topics = ["t1", "t2", "t3", "t4"]
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))
    httpStub.query.mockResolvedValue(flatResults)

    const batchSize = 2
    const delayMs = 100

    const done = client.unpublishRecursively("root", httpStub, {
      batchSize,
      delayMs,
    })

    await jest.advanceTimersByTimeAsync(0)
    expect(mock.publishAsync).toHaveBeenCalledTimes(2)

    // the second batch stays pending until the throttle delay has elapsed
    await jest.advanceTimersByTimeAsync(delayMs - 1)
    expect(mock.publishAsync).toHaveBeenCalledTimes(2)

    await jest.advanceTimersByTimeAsync(1)
    await done

    expect(mock.publishAsync).toHaveBeenCalledTimes(4)
  })
})
