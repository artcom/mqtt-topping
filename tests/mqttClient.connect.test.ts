import { MqttClient } from "../src"
import { ClientOptions } from "../src/mqtt/types"
import { processOptions } from "../src/mqtt/helpers"
import * as mqtt from "mqtt"
import { MqttConnectionError, MqttUsageError } from "../src/errors"

const connectMock = jest.mocked(mqtt.connectAsync)

describe("MqttClient - Connection", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Initialization", () => {
    it("should call mqtt.connectAsync with mqtt:// URI", async () => {
      const brokerUrl = "mqtt://dummy"
      const options: ClientOptions = { clientId: "testClient" }
      await MqttClient.connect(brokerUrl, options)
      const { finalOptions } = processOptions(options)

      expect(connectMock).toHaveBeenCalledTimes(1)
      expect(connectMock).toHaveBeenCalledWith(brokerUrl, finalOptions)
    })

    it("should call mqtt.connectAsync with tcp:// URI", async () => {
      const brokerUrl = "tcp://dummy:1883"
      const options: ClientOptions = { clientId: "testClientTCP" }
      await MqttClient.connect(brokerUrl, options)
      const { finalOptions } = processOptions(options)

      expect(connectMock).toHaveBeenCalledTimes(1)
      expect(connectMock).toHaveBeenCalledWith(brokerUrl, finalOptions)
    })

    it("should call mqtt.connectAsync with ws:// URI", async () => {
      const brokerUrl = "ws://dummy"
      const options: ClientOptions = { clientId: "testClientWS" }
      await MqttClient.connect(brokerUrl, options)
      const { finalOptions } = processOptions(options)

      expect(connectMock).toHaveBeenCalledTimes(1)
      expect(connectMock).toHaveBeenCalledWith(brokerUrl, finalOptions)
    })
  })

  describe("Connection errors", () => {
    it("should throw MqttUsageError for empty broker URI", async () => {
      await expect(MqttClient.connect("")).rejects.toThrow(MqttUsageError)
      await expect(MqttClient.connect("")).rejects.toThrow(
        "MQTT broker URI is required",
      )
      expect(connectMock).not.toHaveBeenCalled()
    })

    it("should throw MqttConnectionError wrapping the cause when connectAsync rejects for an invalid URI", async () => {
      const uriError = new Error("Unknown protocol 'invalid-uri:'") // Simulate error from mqtt.js parsing
      const invalidUri = "invalid-uri"

      connectMock.mockRejectedValueOnce(uriError)

      try {
        await MqttClient.connect(invalidUri)
        throw new Error(
          "MqttClient.connect should have thrown an MqttConnectionError",
        )
      } catch (error) {
        expect(error).toBeInstanceOf(MqttConnectionError)
        expect((error as MqttConnectionError).message).toMatch(
          /Unknown protocol 'invalid-uri:'/,
        )
        expect((error as MqttConnectionError).cause).toBe(uriError)
      }

      expect(connectMock).toHaveBeenCalledWith(invalidUri, expect.any(Object))
      expect(connectMock).toHaveBeenCalledTimes(1)
    })

    it("should throw MqttUsageError for malformed web-based URIs (if URL check is kept)", async () => {
      const malformedWsUri = "ws://bad host name"

      await expect(MqttClient.connect(malformedWsUri)).rejects.toThrow(
        MqttUsageError,
      )
      await expect(MqttClient.connect(malformedWsUri)).rejects.toThrow(
        /Invalid MQTT broker URI format for web-based scheme/,
      )
      expect(connectMock).not.toHaveBeenCalled()
    })

    it("should throw MqttConnectionError wrapping the cause when connectAsync rejects for connection failures", async () => {
      const connectionError = new Error("Connection refused")
      const targetUri = "mqtt://failure"

      connectMock.mockRejectedValueOnce(connectionError)

      try {
        await MqttClient.connect(targetUri)
        throw new Error(
          "MqttClient.connect should have thrown an MqttConnectionError",
        )
      } catch (error) {
        expect(error).toBeInstanceOf(MqttConnectionError)
        expect((error as MqttConnectionError).message).toMatch(
          /Connection refused/,
        )
        expect((error as MqttConnectionError).cause).toBe(connectionError)
      }

      expect(connectMock).toHaveBeenCalledWith(targetUri, expect.any(Object))
      expect(connectMock).toHaveBeenCalledTimes(1)
    })
  })
})
