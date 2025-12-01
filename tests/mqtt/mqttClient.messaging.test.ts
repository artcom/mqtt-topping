import { Packet } from "mqtt"
import { MqttClient } from "../../src"
import * as mqtt from "mqtt"

const connectMock = jest.mocked(mqtt.connectAsync)

describe("MqttClient - Message Handling", () => {
  let client: MqttClient
  beforeEach(async () => {
    jest.clearAllMocks()
    await connectMock("mqtt://dummy")
    client = await MqttClient.connect("mqtt://dummy")
  })

  describe("Payload parsing", () => {
    it("should default to JSON parsing when no parseType is given", async () => {
      const callback = jest.fn()
      await client.subscribe("default/json", callback)

      const payloadObj = { foo: 123 }
      const payload = Buffer.from(JSON.stringify(payloadObj))
      const pkt = {} as Packet

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("default/json", payload, pkt)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(payloadObj, "default/json", pkt)
    })

    it("should parse payload as JSON with parseType='json'", async () => {
      const callback = jest.fn()
      await client.subscribe("json/topic", callback, { parseType: "json" })

      const payloadObj = { bar: "hello" }
      const payload = Buffer.from(JSON.stringify(payloadObj))
      const pkt = {} as Packet

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("json/topic", payload, pkt)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(payloadObj, "json/topic", pkt)
    })

    it("should parse payload as string with parseType='string'", async () => {
      const callback = jest.fn()
      await client.subscribe("text/plain", callback, { parseType: "string" })

      const payload = Buffer.from("some text data")

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("text/plain", payload, {} as Packet)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith("some text data", "text/plain", {})
    })

    it("should pass raw buffer with parseType='buffer'", async () => {
      const callback = jest.fn()
      await client.subscribe("binary/data", callback, { parseType: "buffer" })

      const payload = Buffer.from([0xde, 0xad, 0xbe, 0xef])

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("binary/data", payload, {} as Packet)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0][0]).toEqual(payload)
    })

    it("should update parseType when subscribing again with same callback", async () => {
      const callback = jest.fn()

      await client.subscribe("update/parsing", callback, { parseType: "json" })

      await client.subscribe("update/parsing", callback, {
        parseType: "string",
      })

      const payload = Buffer.from('{"test":123}')

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("update/parsing", payload, {} as Packet)

      expect(callback).toHaveBeenCalledWith(
        '{"test":123}',
        "update/parsing",
        {},
      )
    })
  })

  describe("Custom parsing", () => {
    it("should use custom parser with parseType='custom'", async () => {
      const callback = jest.fn()
      const customParser = jest
        .fn()
        .mockImplementation((buf: Buffer) => `parsed(${buf.toString()})`)

      await client.subscribe("custom/data", callback, {
        parseType: "custom",
        customParser,
      })

      const payload = Buffer.from("custom format")
      const pkt = {} as Packet

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("custom/data", payload, pkt)

      expect(customParser).toHaveBeenCalledWith(payload)
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        "parsed(custom format)",
        "custom/data",
        pkt,
      )
    })
  })

  describe("Error handling (Console)", () => {
    it("should handle invalid JSON and log parse error", async () => {
      const mainCallback = jest.fn()
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

      await client.subscribe("json/invalid", mainCallback, {
        parseType: "json",
      })

      const invalidPayload = Buffer.from("{not valid JSON}")
      const pkt = {} as Packet

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("json/invalid", invalidPayload, pkt)

      expect(mainCallback).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "MQTT payload parse error:",
        expect.any(Error),
      )

      // Verify the error was logged with correct details
      expect(consoleErrorSpy.mock.calls).toHaveLength(1)
      expect(consoleErrorSpy.mock.calls[0]).toHaveLength(2)
      const loggedError = consoleErrorSpy.mock.calls[0][1] as Error
      expect(loggedError.message).toMatch(/Payload parsing failed/)
      expect(loggedError.cause).toBeInstanceOf(SyntaxError)

      consoleErrorSpy.mockRestore()
    })

    it("should handle custom parser errors and log parse error", async () => {
      const callback = jest.fn()
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
      const parserError = new Error("Parser error")

      const failingParser = jest.fn(() => {
        throw parserError
      })

      await client.subscribe("custom/fail", callback, {
        parseType: "custom",
        customParser: failingParser,
      })

      const payload = Buffer.from("bad custom data")
      const pkt = {} as Packet

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("custom/fail", payload, pkt)

      expect(callback).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "MQTT payload parse error:",
        expect.any(Error),
      )

      // Verify the error was logged with correct details
      expect(consoleErrorSpy.mock.calls).toHaveLength(1)
      expect(consoleErrorSpy.mock.calls[0]).toHaveLength(2)
      const loggedError = consoleErrorSpy.mock.calls[0][1] as Error
      expect(loggedError.message).toMatch(/Payload parsing failed/)

      consoleErrorSpy.mockRestore()
    })

    it("should handle JSON parse errors gracefully", async () => {
      const callback = jest.fn()
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

      await client.subscribe("error/in/handler", callback, {
        parseType: "json",
      })

      const invalidPayload = Buffer.from("{not valid JSON}")
      const pkt = {} as Packet

      // Should not throw - errors are logged to console
      expect(() =>
        // @ts-expect-error Accessing private method for testing
        client._handleMessage("error/in/handler", invalidPayload, pkt),
      ).not.toThrow()

      expect(callback).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "MQTT payload parse error:",
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })
  })
  describe("Topic matching", () => {
    it("should do nothing if there are no matching handlers", async () => {
      const callback = jest.fn()
      await client.subscribe("some/other/topic", callback, {
        parseType: "string",
      })

      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "random/unsubscribed",
        Buffer.from("test"),
        {} as Packet,
      )

      expect(callback).not.toHaveBeenCalled()
    })

    it("should handle multiple matching handlers with wildcards", async () => {
      const cbExact = jest.fn()
      const cbWildcard = jest.fn()

      await client.subscribe("home/livingroom", cbExact, {
        parseType: "string",
      })
      await client.subscribe("home/#", cbWildcard, { parseType: "string" })

      const pkt = {} as Packet
      const payload = Buffer.from("lights on")

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("home/livingroom", payload, pkt)

      expect(cbExact).toHaveBeenCalledTimes(1)
      expect(cbExact).toHaveBeenCalledWith("lights on", "home/livingroom", pkt)
      expect(cbWildcard).toHaveBeenCalledTimes(1)
      expect(cbWildcard).toHaveBeenCalledWith(
        "lights on",
        "home/livingroom",
        pkt,
      )
    })

    it("should handle messages for topics with multi-level wildcards (#)", async () => {
      const callback = jest.fn()
      await client.subscribe("devices/#", callback, { parseType: "string" })

      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "devices/livingroom/temp",
        Buffer.from("22C"),
        {} as Packet,
      )

      expect(callback).toHaveBeenCalledWith(
        "22C",
        "devices/livingroom/temp",
        {},
      )
    })

    it("should handle messages for topics with single-level wildcards (+)", async () => {
      const callback = jest.fn()
      await client.subscribe("devices/+/temp", callback, {
        parseType: "string",
      })

      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "devices/livingroom/temp",
        Buffer.from("22C"),
        {} as Packet,
      )
      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "devices/kitchen/temp",
        Buffer.from("24C"),
        {} as Packet,
      )
      // Non-matching path
      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "devices/livingroom/humidity",
        Buffer.from("45%"),
        {} as Packet,
      )

      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenCalledWith(
        "22C",
        "devices/livingroom/temp",
        {},
      )
      expect(callback).toHaveBeenCalledWith("24C", "devices/kitchen/temp", {})
    })

    it("should handle complex wildcard patterns", async () => {
      const callback = jest.fn()
      await client.subscribe("+/+/livingroom/#", callback, {
        parseType: "string",
      })

      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "home/first/livingroom/temp",
        Buffer.from("22C"),
        {} as Packet,
      )
      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "office/second/livingroom/lights",
        Buffer.from("on"),
        {} as Packet,
      )
      // @ts-expect-error Accessing private method for testing
      client._handleMessage(
        "home/first/bedroom/temp",
        Buffer.from("20C"),
        {} as Packet,
      )

      expect(callback).toHaveBeenCalledWith(
        "22C",
        "home/first/livingroom/temp",
        {},
      )
      expect(callback).toHaveBeenCalledWith(
        "on",
        "office/second/livingroom/lights",
        {},
      )
    })
  })
})
