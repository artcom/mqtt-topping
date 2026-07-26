import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import { MqttClient } from "../../src"
import { asMock, type MockMqttClient } from "../../__mocks__/mqtt"
import {
  InvalidTopicError,
  MqttSubscribeError,
  MqttUsageError,
} from "../../src/errors"

describe("MqttClient - Subscribe", () => {
  let mock: MockMqttClient
  let client: MqttClient

  beforeEach(async () => {
    client = await MqttClient.connect("mqtt://dummy")
    mock = asMock(client.underlyingClient)
  })

  describe("Basic functionality", () => {
    it("should call subscribeAsync on first subscription to a topic", async () => {
      const callback = jest.fn()
      await client.subscribe("test/topic", callback)

      expect(mock.subscribeAsync).toHaveBeenCalledTimes(1)
      expect(mock.subscribeAsync).toHaveBeenCalledWith("test/topic", {
        qos: 2,
      })
    })

    it("should only subscribe once for multiple callbacks on same topic", async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      await client.subscribe("test/topic", callback1)
      await client.subscribe("test/topic", callback2)

      expect(mock.subscribeAsync).toHaveBeenCalledTimes(1)

      // both callbacks are served by the single broker subscription
      mock.deliver("test/topic", Buffer.from('{"v":1}'))
      expect(callback1).toHaveBeenCalledWith({ v: 1 }, "test/topic", {})
      expect(callback2).toHaveBeenCalledWith({ v: 1 }, "test/topic", {})
    })

    it("should allow passing QoS in subscribe options", async () => {
      const callback = jest.fn()
      await client.subscribe("test/qos", callback, { qos: 1 })

      expect(mock.subscribeAsync).toHaveBeenCalledWith("test/qos", {
        qos: 1,
      })
    })

    it("should throw InvalidTopicError for invalid topics", async () => {
      const callback = jest.fn()

      await expect(client.subscribe("", callback)).rejects.toThrow(
        InvalidTopicError,
      )
      await expect(
        client.subscribe("invalid/#/topic", callback),
      ).rejects.toThrow(InvalidTopicError)
    })

    it("should throw MqttUsageError when callback is not provided", async () => {
      // Deliberately calling with missing parameter
      await expect(
        // @ts-expect-error - Deliberately calling with missing callback
        client.subscribe("test/topic"),
      ).rejects.toThrow(MqttUsageError)

      // Deliberately passing wrong type
      await expect(
        // @ts-expect-error - Deliberately passing wrong type
        client.subscribe("test/topic", "not-a-function"),
      ).rejects.toThrow(MqttUsageError)
    })

    it("should handle errors from subscribeAsync and clean up on failure", async () => {
      const brokerError = new Error("Broker rejected subscription")
      mock.subscribeAsync.mockRejectedValueOnce(brokerError)

      const callback = jest.fn()
      let failure: unknown

      try {
        await client.subscribe("test/fails", callback)
      } catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(MqttSubscribeError)
      expect((failure as MqttSubscribeError).cause).toBe(brokerError)
      expect((failure as MqttSubscribeError).topic).toBe("test/fails")

      // the failed subscription was rolled back, so a retry hits the broker again
      await client.subscribe("test/fails", callback)

      expect(mock.subscribeAsync).toHaveBeenCalledTimes(2)
      mock.deliver("test/fails", Buffer.from('{"v":1}'))
      expect(callback).toHaveBeenCalledWith({ v: 1 }, "test/fails", {})
    })
  })

  describe("MQTT5 support", () => {
    it("should pass MQTT5 properties to subscribeAsync", async () => {
      const callback = jest.fn()
      const mqttProperties = {
        properties: {
          subscriptionIdentifier: 123,
          userProperties: { "custom-key": "custom-value" },
        },
      }

      await client.subscribe("test/mqtt5", callback, {
        qos: 1,
        ...mqttProperties,
      })

      expect(mock.subscribeAsync).toHaveBeenCalledWith("test/mqtt5", {
        qos: 1,
        properties: mqttProperties.properties,
      })
    })
  })
})
