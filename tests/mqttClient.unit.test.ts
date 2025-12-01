import { MqttClient as MqttJsClient, Packet } from "mqtt"
import { MqttClient } from "../src"
import { ClientOptions, InvalidTopicError } from "../src/mqtt/types"
import { processOptions } from "../src/mqtt/helpers"
import * as mqtt from "mqtt"

const connectMock = jest.mocked(mqtt.connectAsync)

describe("MqttClient", () => {
  let mockMqttClient: jest.Mocked<Partial<MqttJsClient>>
  let client: MqttClient

  beforeEach(async () => {
    jest.clearAllMocks()
    mockMqttClient = await connectMock("mqtt://dummy")
    client = await MqttClient.connect("mqtt://dummy")
  })

  describe("Initialization", () => {
    it("should call mqtt.connect with the given brokerUrl and options", async () => {
      const brokerUrl = "mqtt://dummy"
      const options: ClientOptions = { clientId: "testClient", clean: false }
      const client = await MqttClient.connect(brokerUrl, options)
      const { finalOptions } = processOptions(options)

      expect(mqtt.connectAsync).toHaveBeenCalledWith(brokerUrl, finalOptions)
      expect(client).toBeDefined()
    })

    it("should register an on('message') listener", async () => {
      expect(mockMqttClient.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      )
    })
  })

  describe("Subscribe", () => {
    describe("Basic functionality", () => {
      it("should call subscribeAsync on first subscription to a topic", async () => {
        const callback = jest.fn()
        await client.subscribe("test/topic", callback)

        expect(mockMqttClient.subscribeAsync).toHaveBeenCalledTimes(1)
        expect(mockMqttClient.subscribeAsync).toHaveBeenCalledWith(
          "test/topic",
          {
            qos: 2,
          },
        )
      })

      it("should only subscribe once for multiple callbacks on same topic", async () => {
        const callback1 = jest.fn()
        const callback2 = jest.fn()

        await client.subscribe("test/topic", callback1)
        await client.subscribe("test/topic", callback2)

        expect(mockMqttClient.subscribeAsync).toHaveBeenCalledTimes(1)
        expect(client["subscriptions"]["test/topic"].handlers).toHaveLength(2)
      })

      it("should allow passing QoS in subscribe options", async () => {
        const callback = jest.fn()
        await client.subscribe("test/qos", callback, { qos: 1 })

        expect(mockMqttClient.subscribeAsync).toHaveBeenCalledWith("test/qos", {
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

        expect(mockMqttClient.subscribeAsync).toHaveBeenCalledWith(
          "test/mqtt5",
          {
            qos: 1,
            properties: mqttProperties.properties,
          },
        )
      })
    })
  })

  describe("Unsubscribe", () => {
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
    })
  })

  describe("Message handling", () => {
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
        expect(callback).toHaveBeenCalledWith(
          "some text data",
          "text/plain",
          {},
        )
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

        // @ts-expect-error Accessing private method for testing
        client._handleMessage("custom/data", payload, {} as Packet)

        expect(customParser).toHaveBeenCalledWith(payload)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith(
          "parsed(custom format)",
          "custom/data",
          {},
        )
      })
    })

    describe("Error handling", () => {
      it("should handle invalid JSON and log parse error", async () => {
        const mainCallback = jest.fn()
        const consoleErrorSpy = jest
          .spyOn(console, "error")
          .mockImplementation()

        await client.subscribe("json/invalid", mainCallback, {
          parseType: "json",
        })

        await client.subscribe("json/invalid", mainCallback, {
          parseType: "json",
        })

        const invalidPayload = Buffer.from("{not valid JSON}")

        // @ts-expect-error Accessing private method for testing
        client._handleMessage("json/invalid", invalidPayload, {} as Packet)

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "MQTT payload parse error:",
          expect.any(Error),
        )

        consoleErrorSpy.mockRestore()
      })
    })

    it("should handle custom parser errors and log parse error", async () => {
      const callback = jest.fn()
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

      const failingParser = jest.fn(() => {
        throw new Error("Parser error")
      })

      await client.subscribe("custom/fail", callback, {
        parseType: "custom",
        customParser: failingParser,
      })

      const payload = Buffer.from("bad custom data")

      // @ts-expect-error Accessing private method for testing
      client._handleMessage("custom/fail", payload, {} as Packet)

      expect(callback).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "MQTT payload parse error:",
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
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
        expect(cbExact).toHaveBeenCalledWith(
          "lights on",
          "home/livingroom",
          pkt,
        )
        expect(cbWildcard).toHaveBeenCalledTimes(1)
        expect(cbWildcard).toHaveBeenCalledWith(
          "lights on",
          "home/livingroom",
          pkt,
        )
      })
    })
  })

  describe("Publishing", () => {
    it("should publish messages with correct QoS and retain settings", async () => {
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

    it("should unpublish by sending empty retained message", async () => {
      await client.unpublish("test/retained")

      expect(mockMqttClient.publishAsync).toHaveBeenCalledTimes(1)

      const [topic, payload, opts] = (mockMqttClient.publishAsync as jest.Mock)
        .mock.calls[0]
      expect(topic).toBe("test/retained")
      expect(payload.toString()).toBe("")
      expect(opts).toMatchObject({ qos: 2, retain: true })
    })
  })
})
