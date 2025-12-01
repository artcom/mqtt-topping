import { MqttClient as MqttJsClient } from "mqtt"
import { MqttClient } from "../src"
import * as mqtt from "mqtt"
import {
  MqttPayloadError,
  InvalidTopicError,
  MqttPublishError,
} from "../src/errors"

const connectMock = jest.mocked(mqtt.connectAsync)

describe("MqttClient - Publishing", () => {
  let mockMqttClient: jest.Mocked<Partial<MqttJsClient>>
  let client: MqttClient

  beforeEach(async () => {
    jest.clearAllMocks()
    mockMqttClient = await connectMock("mqtt://dummy")
    client = await MqttClient.connect("mqtt://dummy")
  })

  describe("Basic publishing", () => {
    it("should publish messages with correct QoS and retain settings (default JSON)", async () => {
      await client.publish(
        "test/topic",
        { data: "value" },
        { qos: 1, retain: true },
      )

      expect(mockMqttClient.publishAsync).toHaveBeenCalledTimes(1)

      const [topic, payload, opts] = (mockMqttClient.publishAsync as jest.Mock)
        .mock.calls[0]
      expect(topic).toBe("test/topic")
      expect(JSON.parse(payload.toString())).toEqual({ data: "value" })
      expect(opts).toMatchObject({ qos: 1, retain: true })
    })

    it("should unpublish by sending empty retained message (JSON stringify of undefined)", async () => {
      await client.unpublish("test/retained")

      expect(mockMqttClient.publishAsync).toHaveBeenCalledTimes(1)

      const [topic, payload, opts] = (mockMqttClient.publishAsync as jest.Mock)
        .mock.calls[0]
      expect(topic).toBe("test/retained")
      expect(payload.toString()).toBe("")
      expect(opts).toMatchObject({ qos: 2, retain: true })
    })

    it("should use default QoS when not specified", async () => {
      await client.publish("test/defaults", { data: "value" })

      const [, , opts] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(opts.qos).toBe(2)
    })

    it("should correctly determine retain flag for event topics (prefix based)", async () => {
      await client.publish("some/device/onUpdate", { data: "value" })
      const [, , optsEvent] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(optsEvent.retain).toBe(false)
    })

    it("should correctly determine retain flag for command topics (prefix based)", async () => {
      await client.publish("another/device/doRestart", { data: "value" })
      const [, , optsCmd] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(optsCmd.retain).toBe(false)
    })

    it("should default to retain=true for regular topics", async () => {
      await client.publish("device/status", { data: "value" })
      const [, , optsRegular] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(optsRegular.retain).toBe(true)
    })
  })

  describe("Payload handling (without custom)", () => {
    it("should serialize data as JSON by default", async () => {
      const data = { complex: { nested: [1, 2, 3] } }
      await client.publish("test/json", data)

      const [, payload] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(JSON.parse(payload.toString())).toEqual(data)
    })

    it("should publish string data with parseType='string'", async () => {
      const data = "hello world"
      await client.publish("test/string", data, { parseType: "string" })

      const [, payload] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(payload.toString()).toBe(data)
    })

    it("should publish buffer data directly with parseType='buffer'", async () => {
      const data = Buffer.from([0x01, 0x02, 0x03])
      await client.publish("test/buffer", data, { parseType: "buffer" })

      const [, payload] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(payload).toBe(data)
    })

    it("should convert non-buffer data to buffer with parseType='buffer'", async () => {
      const data = "convert me to buffer"
      await client.publish("test/buffer-convert", data, { parseType: "buffer" })

      const [, payload] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[0]
      expect(payload).toBeInstanceOf(Buffer)
      expect(payload.toString()).toBe(data)

      const numData = 123
      await client.publish("test/buffer-convert-num", numData, {
        parseType: "buffer",
      })
      const [, payloadNum] = (mockMqttClient.publishAsync as jest.Mock).mock
        .calls[1]
      expect(payloadNum).toBeInstanceOf(Buffer)
      expect(payloadNum.toString()).toBe(String(numData))
    })
  })

  describe("Error handling (without custom parser errors)", () => {
    it("should throw InvalidTopicError (via validateTopic) for empty topics", async () => {
      await expect(client.publish("", { data: "value" })).rejects.toThrow(
        InvalidTopicError,
      )
      await expect(client.publish("", { data: "value" })).rejects.toThrow(
        "topic must be a non-empty string",
      )
    })

    it("should throw InvalidTopicError (via validateTopicForPublish) for wildcard topics", async () => {
      await expect(client.publish("test/#", { data: "value" })).rejects.toThrow(
        InvalidTopicError,
      )
      await expect(client.publish("test/#", { data: "value" })).rejects.toThrow(
        "publishing to wildcard topics ('#' or '+') is not allowed",
      )

      await expect(
        client.publish("test/+/topic", { data: "value" }),
      ).rejects.toThrow(InvalidTopicError)
      await expect(
        client.publish("test/+/topic", { data: "value" }),
      ).rejects.toThrow(
        "publishing to wildcard topics ('#' or '+') is not allowed",
      )
    })

    it("should throw InvalidTopicError (via validateTopic) for topics with null characters", async () => {
      await expect(
        client.publish(`test/${String.fromCharCode(0)}topic`, {
          data: "value",
        }),
      ).rejects.toThrow(InvalidTopicError)
      await expect(
        client.publish(`test/${String.fromCharCode(0)}topic`, {
          data: "value",
        }),
      ).rejects.toThrow("topic must not contain null characters")
    })

    it("should throw MqttPayloadError when JSON.stringify fails (default parseType)", async () => {
      const circular: Record<string, unknown> = { prop: "value" }
      circular.self = circular
      await expect(client.publish("test/error", circular)).rejects.toThrow(
        MqttPayloadError,
      )
      await expect(client.publish("test/error", circular)).rejects.toThrow(
        /Failed to JSON stringify payload/,
      )
    })

    it("should throw MqttPayloadError when JSON.stringify fails (explicit 'json' parseType)", async () => {
      const circular: Record<string, unknown> = { prop: "value" }
      circular.self = circular
      await expect(
        client.publish("test/error", circular, { parseType: "json" }),
      ).rejects.toThrow(MqttPayloadError)
      await expect(
        client.publish("test/error", circular, { parseType: "json" }),
      ).rejects.toThrow(/Failed to JSON stringify payload/)
    })

    it("should throw MqttPublishError when underlying publishAsync fails", async () => {
      const publishError = new Error("Broker unavailable")
      ;(mockMqttClient.publishAsync as jest.Mock).mockRejectedValueOnce(
        publishError,
      )

      await expect(
        client.publish("test/network-error", "data"),
      ).rejects.toThrow(MqttPublishError)
      try {
        await client.publish("test/network-error", "data")
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(MqttPublishError)
        const error = e as MqttPublishError
        expect(error.cause).toBe(publishError)
        expect(error.topic).toBe("test/network-error")
      }
    })

    it("should verify unpublish validates topics properly", async () => {
      await expect(client.unpublish("")).rejects.toThrow(InvalidTopicError)
      await expect(client.unpublish("")).rejects.toThrow(
        "topic must be a non-empty string",
      )

      await expect(client.unpublish("test/#")).rejects.toThrow(
        InvalidTopicError,
      )
      await expect(client.unpublish("test/#")).rejects.toThrow(
        "publishing to wildcard topics ('#' or '+') is not allowed",
      )
    })
  })
})
