import { MqttClient } from "../src"
import { HttpClient } from "../src/http/httpClient"
import * as mqtt from "mqtt"
import { FlatTopicResult } from "../src/http/types"

const connectMock = jest.mocked(mqtt.connectAsync)

describe("MqttClient - Recursive Unpublish", () => {
  let mockMqttClient: jest.Mocked<Partial<mqtt.MqttClient>>
  let client: MqttClient
  let mockHttpClient: jest.Mocked<HttpClient>

  beforeEach(async () => {
    jest.clearAllMocks()
    mockMqttClient = await connectMock("mqtt://dummy")
    client = await MqttClient.connect("mqtt://dummy")

    // Mock HttpClient
    mockHttpClient = {
      query: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>
  })

  it("should unpublish all discovered topics", async () => {
    const topics = ["root/topic", "root/topic/sub1", "root/topic/sub2"]
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))

    mockHttpClient.query.mockResolvedValue(flatResults)

    await client.unpublishRecursively("root/topic", mockHttpClient)

    expect(mockHttpClient.query).toHaveBeenCalledWith({
      topic: "root/topic",
      depth: -1,
      flatten: true,
      parseJson: false,
    })

    expect(mockMqttClient.publishAsync).toHaveBeenCalledTimes(3)

    // Verify all topics were unpublished
    const calls = (mockMqttClient.publishAsync as jest.Mock).mock.calls
    const unpublishedTopics = calls.map((call) => call[0])
    expect(unpublishedTopics).toEqual(expect.arrayContaining(topics))

    // Verify unpublish payload (empty string, retained)
    calls.forEach((call) => {
      expect(call[1].toString()).toBe("")
      expect(call[2]).toMatchObject({ retain: true })
    })
  })

  it("should do nothing if no topics found", async () => {
    mockHttpClient.query.mockResolvedValue([])

    await client.unpublishRecursively("root/empty", mockHttpClient)

    expect(mockMqttClient.publishAsync).not.toHaveBeenCalled()
  })

  it("should batch unpublish calls", async () => {
    const topics = Array.from({ length: 15 }, (_, i) => `topic/${i}`)
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))
    mockHttpClient.query.mockResolvedValue(flatResults)

    const batchSize = 5
    await client.unpublishRecursively("root", mockHttpClient, { batchSize })

    expect(mockMqttClient.publishAsync).toHaveBeenCalledTimes(15)
  })

  it("should throttle unpublish calls", async () => {
    const topics = ["t1", "t2", "t3", "t4"]
    const flatResults: FlatTopicResult[] = topics.map((t) => ({ topic: t }))
    mockHttpClient.query.mockResolvedValue(flatResults)

    const batchSize = 2
    const delayMs = 100

    const start = Date.now()
    await client.unpublishRecursively("root", mockHttpClient, {
      batchSize,
      delayMs,
    })
    const duration = Date.now() - start

    expect(mockMqttClient.publishAsync).toHaveBeenCalledTimes(4)
    // Should have waited at least once (4 items / 2 batch size = 2 chunks. 1 delay between them)
    expect(duration).toBeGreaterThanOrEqual(delayMs - 20) // Allow some margin
  })
})
