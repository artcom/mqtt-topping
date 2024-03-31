// fails
const { delayUntil, delay } = require("./util")
const { connectAsync, HttpClient, unpublishRecursively } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://127.0.0.1"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://127.0.0.1:8080"

describe("MQTT Client", () => {
  let mqttClient
  let httpClient
  let testTopic
  let onParseError

  beforeEach(async () => {
    onParseError = jest.fn()

    mqttClient = await connectAsync(tcpBrokerUri, {
      onParseError,
      appId: "Test",
      deviceId: "DeviceId",
    })

    httpClient = new HttpClient(httpBrokerUri)

    testTopic = `test/topping-${Math.random()}`

    await mqttClient.publish(`${testTopic}/foo`, "bar")
    await mqttClient.publish(`${testTopic}/baz`, 23)

    // ensure that the publishes are processed on the server before testing
    await delay(100)
  })

  afterEach(async () => {
    await unpublishRecursively(mqttClient, httpClient, testTopic)
    mqttClient.disconnect()
  })

  describe("subscribe", () => {
    test("should retrieve retained messages", async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      await mqttClient.subscribe(`${testTopic}/foo`, handler1)
      await mqttClient.subscribe(`${testTopic}/baz`, handler2)

      await delayUntil(() => handler1.mock.calls.length === 1 && handler2.mock.calls.length === 1)

      expect(handler1.mock.calls[0][0]).toBe("bar")
      expect(handler1.mock.calls[0][1]).toBe(`${testTopic}/foo`)
      expect(handler2.mock.calls[0][0]).toBe(23)
      expect(handler2.mock.calls[0][1]).toBe(`${testTopic}/baz`)
    })

    test("should retrieve non-retained messages", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await mqttClient.subscribe(eventTopic, handler)
      await mqttClient.publish(eventTopic, "hello")

      await delayUntil(() => handler.mock.calls.length === 1)

      expect(handler.mock.calls[0][0]).toBe("hello")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
    })

    test("should receive messages with empty payload", async () => {
      const handler = jest.fn()

      await mqttClient.subscribe(`${testTopic}/foo`, handler)
      await mqttClient.unpublish(`${testTopic}/foo`)

      await delayUntil(() => handler.mock.calls.length === 2)

      expect(handler.mock.calls[0][0]).toBe("bar")
      expect(handler.mock.calls[0][1]).toBe(`${testTopic}/foo`)
      expect(handler.mock.calls[1][0]).toBe(undefined)
      expect(handler.mock.calls[1][1]).toBe(`${testTopic}/foo`)
    })

    test("should retrieve retained messages using hash wildcard", async () => {
      const handler = jest.fn()
      await mqttClient.subscribe(`${testTopic}/#`, handler)

      await delayUntil(() => handler.mock.calls.length === 2)

      const topics = {
        [handler.mock.calls[0][1]]: handler.mock.calls[0][0],
        [handler.mock.calls[1][1]]: handler.mock.calls[1][0],
      }

      expect(topics).toEqual({
        [`${testTopic}/baz`]: 23,
        [`${testTopic}/foo`]: "bar",
      })
    })

    test("should retrieve retained messages using plus wildcard", async () => {
      const handler = jest.fn()
      await mqttClient.subscribe(`${testTopic}/+`, handler)

      await delayUntil(() => handler.mock.calls.length === 2)

      const topics = {
        [handler.mock.calls[0][1]]: handler.mock.calls[0][0],
        [handler.mock.calls[1][1]]: handler.mock.calls[1][0],
      }

      expect(topics).toEqual({
        [`${testTopic}/baz`]: 23,
        [`${testTopic}/foo`]: "bar",
      })
    })

    test("should ignore malformed JSON payloads", async () => {
      const eventTopic = `${testTopic}/onEvent`

      await mqttClient.subscribe(eventTopic, () => "noop")

      await mqttClient.publish(eventTopic, "this is invalid JSON", { stringifyJson: false })

      await delayUntil(() => onParseError.mock.calls.length === 1)

      expect(onParseError.mock.calls[0][0]).toEqual(Buffer.from("this is invalid JSON"))
      expect(onParseError.mock.calls[0][1]).toBe(eventTopic)
    })

    test("should receive raw payload when JSON parsing is disabled", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await mqttClient.subscribe(eventTopic, handler, { parseJson: false })

      await mqttClient.publish(eventTopic, "this is invalid JSON", { stringifyJson: false })
      mqttClient.publish()
      await mqttClient.publish(eventTopic, "42", { stringifyJson: false })

      await delayUntil(() => handler.mock.calls.length === 2)

      expect(handler.mock.calls[0][0]).toBe("this is invalid JSON")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(handler.mock.calls[1][0]).toBe("42")
      expect(handler.mock.calls[1][1]).toBe(eventTopic)
    })
  })

  describe("unsubscribe", () => {
    test("should ignore unsubscribe of unknown topic", async () => {
      const handler = jest.fn()
      const topic = `${testTopic}/onFoo`

      expect(mqttClient.subscriptions).toEqual({})
      await mqttClient.unsubscribe(topic, handler)
      expect(mqttClient.subscriptions).toEqual({})
    })

    test("should not receive messages after unsubscribing", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await mqttClient.subscribe(eventTopic, handler)

      await mqttClient.publish(eventTopic, "hello")

      await delayUntil(() => handler.mock.calls.length === 1)

      await mqttClient.unsubscribe(eventTopic, handler)

      await mqttClient.publish(eventTopic, "goodbye")

      await mqttClient.subscribe(eventTopic, handler)

      await mqttClient.publish(eventTopic, "hello again")

      await delayUntil(() => handler.mock.calls.length === 2)

      expect(handler.mock.calls[0][0]).toBe("hello")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(handler.mock.calls[1][0]).toBe("hello again")
      expect(handler.mock.calls[1][1]).toBe(eventTopic)
    })
  })

  describe("publish", () => {
    test("should use QoS 2 by default", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await mqttClient.subscribe(eventTopic, handler)

      await mqttClient.publish(eventTopic, "hello")

      await delayUntil(() => handler.mock.calls.length === 1)

      expect(handler.mock.calls[0][0]).toBe("hello")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(handler.mock.calls[0][2].qos).toBe(2)
    })

    test("should override QoS", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await mqttClient.subscribe(eventTopic, handler)

      await mqttClient.publish(eventTopic, "hello", { qos: 0 })

      await delayUntil(() => handler.mock.calls.length === 1)

      expect(handler.mock.calls[0][0]).toBe("hello")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(handler.mock.calls[0][2].qos).toBe(0)
    })

    test("should publish messages without stringifying", async () => {
      const topic = `${testTopic}/raw`

      await mqttClient.publish(topic, "invalid\nJSON", { stringifyJson: false })

      const response = await httpClient.query({ topic, parseJson: false })
      expect(response).toEqual({ topic, payload: "invalid\nJSON" })
    })

    test("should unpublish messages", async () => {
      await mqttClient.unpublish(`${testTopic}/foo`)

      const response = await httpClient.query({ topic: testTopic, depth: 1 })
      expect(response).toEqual({
        topic: testTopic,
        children: [{ topic: `${testTopic}/baz`, payload: 23 }],
      })
    })

    test("should unpublish messages recursively", async () => {
      await unpublishRecursively(mqttClient, httpClient, testTopic)

      return expect(httpClient.query({ topic: testTopic })).rejects.toThrow(
        new Error(JSON.stringify({ error: 404, topic: testTopic }))
      )
    })
  })
})
