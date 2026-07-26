import { jest, describe, it, expect, beforeEach } from "@jest/globals"
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
    const topics = Array.from({ length: 15 }, (_, i) => `topic/${i}`)
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))
    httpStub.query.mockResolvedValue(flatResults)

    const batchSize = 5
    await client.unpublishRecursively("root", httpStub, { batchSize })

    expect(mock.publishAsync).toHaveBeenCalledTimes(15)
  })

  it("should throttle unpublish calls", async () => {
    const topics = ["t1", "t2", "t3", "t4"]
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))
    httpStub.query.mockResolvedValue(flatResults)

    const batchSize = 2
    const delayMs = 100

    const start = Date.now()
    await client.unpublishRecursively("root", httpStub, {
      batchSize,
      delayMs,
    })
    const duration = Date.now() - start

    expect(mock.publishAsync).toHaveBeenCalledTimes(4)
    // Should have waited at least once (4 items / 2 batch size = 2 chunks. 1 delay between them)
    expect(duration).toBeGreaterThanOrEqual(delayMs - 20) // Allow some margin
  })
})
