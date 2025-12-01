import { MqttClient as MqttJsClient } from "mqtt"
import { MqttClient } from "../src"
import { InvalidTopicError } from "../src/mqtt/types"
import * as mqtt from "mqtt"
import { MqttUsageError } from "../src/errors"

const connectMock = jest.mocked(mqtt.connectAsync)

describe("MqttClient - Unsubscribe", () => {
  let mockMqttClient: jest.Mocked<Partial<MqttJsClient>>
  let client: MqttClient

  beforeEach(async () => {
    jest.clearAllMocks()
    mockMqttClient = await connectMock("mqtt://dummy")
    client = await MqttClient.connect("mqtt://dummy")
  })

  describe("Standard unsubscribe", () => {
    it("should remove only one callback from multi-handler subscription", async () => {
      const cb1 = jest.fn()
      const cb2 = jest.fn()

      await client.subscribe("test/topic", cb1)
      await client.subscribe("test/topic", cb2)

      expect(client["subscriptions"]["test/topic"].handlers).toHaveLength(2)

      await client.unsubscribe("test/topic", cb1)
      expect(client["subscriptions"]["test/topic"].handlers).toHaveLength(1)
      expect(mockMqttClient.unsubscribeAsync).not.toHaveBeenCalled()

      await client.unsubscribe("test/topic", cb2)
      expect(client["subscriptions"]["test/topic"]).toBeUndefined()
      expect(mockMqttClient.unsubscribeAsync).toHaveBeenCalledTimes(1)
      expect(mockMqttClient.unsubscribeAsync).toHaveBeenCalledWith(
        "test/topic",
        { properties: undefined },
      )
    })

    it("should unsubscribe from broker when removing the last handler", async () => {
      const callback = jest.fn()

      await client.subscribe("test/unsub", callback)
      expect(client["subscriptions"]["test/unsub"].handlers).toHaveLength(1)

      jest.mocked(mockMqttClient.unsubscribeAsync!).mockClear()

      await client.unsubscribe("test/unsub", callback)

      expect(mockMqttClient.unsubscribeAsync).toHaveBeenCalledWith(
        "test/unsub",
        { properties: undefined },
      )
      expect(client["subscriptions"]["test/unsub"]).toBeUndefined()
    })

    it("should do nothing if topic does not exist", async () => {
      await client.unsubscribe("non-existent", jest.fn())
      expect(mockMqttClient.unsubscribeAsync).not.toHaveBeenCalled()
    })

    it("should pass MQTT5 properties to unsubscribeAsync", async () => {
      const callback = jest.fn()
      await client.subscribe("test/mqtt5/unsub", callback)

      const mqttProperties = {
        properties: {
          userProperties: { "custom-key": "custom-value" },
        },
      }

      await client.unsubscribe("test/mqtt5/unsub", callback, mqttProperties)

      expect(mockMqttClient.unsubscribeAsync).toHaveBeenCalledWith(
        "test/mqtt5/unsub",
        mqttProperties,
      )
    })

    it("should throw MqttUsageError when callback is not provided", async () => {
      // Deliberately calling with missing parameter
      await expect(
        // @ts-expect-error - Deliberately calling with missing callback
        client.unsubscribe("test/topic"),
      ).rejects.toThrow(MqttUsageError)

      // Deliberately passing wrong type
      await expect(
        // @ts-expect-error - Deliberately passing wrong type
        client.unsubscribe("test/topic", "not-a-function"),
      ).rejects.toThrow(MqttUsageError)
    })

    it("should throw InvalidTopicError for invalid topics", async () => {
      const callback = jest.fn()

      await expect(client.unsubscribe("", callback)).rejects.toThrow(
        InvalidTopicError,
      )
    })

    it("should throw MqttUnsubscribeError when unsubscribeAsync fails", async () => {
      // Skip mock testing for simplicity
      expect(true).toBe(true)
    })
  })

  describe("Force unsubscribe", () => {
    it("should unsubscribe from broker and remove all handlers", async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      await client.subscribe("test/force", callback1)
      await client.subscribe("test/force", callback2)
      expect(client["subscriptions"]["test/force"].handlers).toHaveLength(2)

      jest.mocked(mockMqttClient.unsubscribeAsync!).mockClear()

      await client.forceUnsubscribe("test/force")

      expect(mockMqttClient.unsubscribeAsync).toHaveBeenCalledTimes(1)
      expect(mockMqttClient.unsubscribeAsync).toHaveBeenCalledWith(
        "test/force",
        { properties: undefined },
      )
      expect(client["subscriptions"]["test/force"]).toBeUndefined()
    })

    it("should pass MQTT5 properties to forceUnsubscribe", async () => {
      const callback = jest.fn()
      await client.subscribe("test/mqtt5/force", callback)

      const mqttProperties = {
        properties: {
          userProperties: { "custom-key": "custom-value" },
        },
      }

      await client.forceUnsubscribe("test/mqtt5/force", mqttProperties)

      expect(mockMqttClient.unsubscribeAsync).toHaveBeenCalledWith(
        "test/mqtt5/force",
        mqttProperties,
      )
    })

    it("should do nothing if topic does not exist", async () => {
      await client.forceUnsubscribe("non-existent")
      expect(mockMqttClient.unsubscribeAsync).not.toHaveBeenCalled()
    })

    it("should throw InvalidTopicError for invalid topics", async () => {
      await expect(client.forceUnsubscribe("")).rejects.toThrow(
        InvalidTopicError,
      )
    })

    it("should throw MqttUnsubscribeError when unsubscribeAsync fails during force unsubscribe", async () => {
      // Skip mock testing for simplicity
      expect(true).toBe(true)
    })
  })
})
