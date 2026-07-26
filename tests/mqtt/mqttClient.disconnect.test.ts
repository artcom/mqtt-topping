import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import { MqttClient } from "../../src"
import { asMock, type MockMqttClient } from "../../__mocks__/mqtt"
import { MqttDisconnectError } from "../../src/errors"

describe("MqttClient - Disconnect", () => {
  let mock: MockMqttClient
  let client: MqttClient

  beforeEach(async () => {
    client = await MqttClient.connect("mqtt://dummy")
    mock = asMock(client.underlyingClient)
  })

  describe("Ending the connection", () => {
    it("should end the connection gracefully by default", async () => {
      await client.disconnect()

      expect(mock.endAsync).toHaveBeenCalledTimes(1)
      expect(mock.endAsync).toHaveBeenCalledWith(false)
    })

    it("should force-end the connection when requested", async () => {
      await client.disconnect(true)

      expect(mock.endAsync).toHaveBeenCalledWith(true)
    })

    it("should unsubscribe from all subscribed topics", async () => {
      await client.subscribe("test/one", jest.fn())
      await client.subscribe("test/two", jest.fn())

      await client.disconnect()

      expect(mock.unsubscribeAsync).toHaveBeenCalledTimes(1)
      expect(mock.unsubscribeAsync).toHaveBeenCalledWith([
        "test/one",
        "test/two",
      ])
      expect(mock.endAsync).toHaveBeenCalledTimes(1)
    })

    it("should not unsubscribe when there are no subscriptions", async () => {
      await client.disconnect()

      expect(mock.unsubscribeAsync).not.toHaveBeenCalled()
    })

    it("should throw MqttDisconnectError when endAsync fails", async () => {
      const endError = new Error("Socket already closed")
      mock.endAsync.mockRejectedValueOnce(endError)

      let failure: unknown
      try {
        await client.disconnect()
      } catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(MqttDisconnectError)
      expect((failure as MqttDisconnectError).message).toMatch(
        /Failed to end MQTT connection/,
      )
      expect((failure as MqttDisconnectError).cause).toBe(endError)
    })

    it("should still end the connection when unsubscribing fails", async () => {
      await client.subscribe("test/cleanup", jest.fn())
      mock.unsubscribeAsync.mockRejectedValueOnce(
        new Error("Connection already lost"),
      )

      await expect(client.disconnect()).resolves.toBeUndefined()

      expect(mock.endAsync).toHaveBeenCalledTimes(1)
    })
  })

  describe("Listener cleanup", () => {
    it("should remove its own event listeners", async () => {
      expect(mock.listenerCount("message")).toBe(1)
      expect(mock.listenerCount("error")).toBe(1)

      await client.disconnect()

      expect(mock.listenerCount("message")).toBe(0)
      expect(mock.listenerCount("error")).toBe(0)
    })

    it("should not deliver messages after disconnecting", async () => {
      const callback = jest.fn()
      await client.subscribe("test/late", callback)

      await client.disconnect()
      mock.emit("message", "test/late", Buffer.from('{"v":1}'), {})

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe("Connection state", () => {
    it("should report the underlying connected state", () => {
      expect(client.isConnected()).toBe(false)

      mock.connected = true

      expect(client.isConnected()).toBe(true)
    })

    it("should report the underlying reconnecting state", () => {
      expect(client.isReconnecting()).toBe(false)

      mock.reconnecting = true

      expect(client.isReconnecting()).toBe(true)
    })
  })
})
