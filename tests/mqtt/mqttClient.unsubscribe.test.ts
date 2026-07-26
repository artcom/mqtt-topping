import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import { MqttClient } from "../../src"
import { asMock, type MockMqttClient } from "../../__mocks__/mqtt"
import {
  InvalidTopicError,
  MqttUnsubscribeError,
  MqttUsageError,
} from "../../src/errors"

describe("MqttClient - Unsubscribe", () => {
  let mock: MockMqttClient
  let client: MqttClient

  beforeEach(async () => {
    client = await MqttClient.connect("mqtt://dummy")
    mock = asMock(client.underlyingClient)
  })

  describe("Standard unsubscribe", () => {
    it("should remove only one callback from multi-handler subscription", async () => {
      const cb1 = jest.fn()
      const cb2 = jest.fn()

      await client.subscribe("test/topic", cb1)
      await client.subscribe("test/topic", cb2)

      await client.unsubscribe("test/topic", cb1)

      // the remaining handler keeps receiving messages, so no broker unsubscribe
      expect(mock.unsubscribeAsync).not.toHaveBeenCalled()
      mock.emit("message", "test/topic", Buffer.from('{"v":1}'), {})
      expect(cb1).not.toHaveBeenCalled()
      expect(cb2).toHaveBeenCalledTimes(1)

      await client.unsubscribe("test/topic", cb2)

      expect(mock.unsubscribeAsync).toHaveBeenCalledTimes(1)
      expect(mock.unsubscribeAsync).toHaveBeenCalledWith("test/topic", {
        properties: undefined,
      })
      mock.emit("message", "test/topic", Buffer.from('{"v":2}'), {})
      expect(cb2).toHaveBeenCalledTimes(1)
    })

    it("should unsubscribe from broker when removing the last handler", async () => {
      const callback = jest.fn()

      await client.subscribe("test/unsub", callback)

      await client.unsubscribe("test/unsub", callback)

      expect(mock.unsubscribeAsync).toHaveBeenCalledWith("test/unsub", {
        properties: undefined,
      })
      mock.emit("message", "test/unsub", Buffer.from('{"v":1}'), {})
      expect(callback).not.toHaveBeenCalled()
    })

    it("should do nothing if topic does not exist", async () => {
      await client.unsubscribe("non-existent", jest.fn())
      expect(mock.unsubscribeAsync).not.toHaveBeenCalled()
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

      expect(mock.unsubscribeAsync).toHaveBeenCalledWith(
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
      const callback = jest.fn()
      await client.subscribe("test/unsub/fails", callback)

      const brokerError = new Error("Broker rejected unsubscribe")
      mock.unsubscribeAsync.mockRejectedValueOnce(brokerError)

      let failure: unknown
      try {
        await client.unsubscribe("test/unsub/fails", callback)
      } catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(MqttUnsubscribeError)
      expect((failure as MqttUnsubscribeError).cause).toBe(brokerError)
      expect((failure as MqttUnsubscribeError).topic).toBe("test/unsub/fails")
    })
  })

  describe("Force unsubscribe", () => {
    it("should unsubscribe from broker and remove all handlers", async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      await client.subscribe("test/force", callback1)
      await client.subscribe("test/force", callback2)

      await client.forceUnsubscribe("test/force")

      expect(mock.unsubscribeAsync).toHaveBeenCalledTimes(1)
      expect(mock.unsubscribeAsync).toHaveBeenCalledWith("test/force", {
        properties: undefined,
      })

      // every handler for the topic is gone, not just one
      mock.emit("message", "test/force", Buffer.from('{"v":1}'), {})
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
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

      expect(mock.unsubscribeAsync).toHaveBeenCalledWith(
        "test/mqtt5/force",
        mqttProperties,
      )
    })

    it("should do nothing if topic does not exist", async () => {
      await client.forceUnsubscribe("non-existent")
      expect(mock.unsubscribeAsync).not.toHaveBeenCalled()
    })

    it("should throw InvalidTopicError for invalid topics", async () => {
      await expect(client.forceUnsubscribe("")).rejects.toThrow(
        InvalidTopicError,
      )
    })

    it("should throw MqttUnsubscribeError when unsubscribeAsync fails during force unsubscribe", async () => {
      const callback = jest.fn()
      await client.subscribe("test/force/fails", callback)

      const brokerError = new Error("Broker rejected unsubscribe")
      mock.unsubscribeAsync.mockRejectedValueOnce(brokerError)

      let failure: unknown
      try {
        await client.forceUnsubscribe("test/force/fails")
      } catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(MqttUnsubscribeError)
      expect((failure as MqttUnsubscribeError).message).toMatch(
        /forceUnsubscribe failed/,
      )
      expect((failure as MqttUnsubscribeError).cause).toBe(brokerError)
    })
  })
})
