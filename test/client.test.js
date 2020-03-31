const { delayUntil, delay } = require("./util")
const topping = require("../lib/main")

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080/query"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"


describe("MQTT Client", () => {
  let client
  let testTopic
  let onParseError

  beforeEach(async () => {
    onParseError = jest.fn()

    client = await topping.connect(tcpBrokerUri, httpBrokerUri, { onParseError })
    testTopic = `test/topping-${Date.now()}`

    await client.publish(`${testTopic}/foo`, "bar")
    await client.publish(`${testTopic}/baz`, 23)

    // ensure that the publishes are processed on the server before testing
    await delay(100)
  })

  afterEach(async () => {
    await client.unpublishRecursively(testTopic)
    client.disconnect()
  })

  describe("subscribe", () => {
    test("should retrieve retained messages", async () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      await client.subscribe(`${testTopic}/foo`, handler1)
      await client.subscribe(`${testTopic}/baz`, handler2)

      await delayUntil(() =>
        handler1.mock.calls.length === 1 &&
        handler2.mock.calls.length === 1
      )

      expect(handler1.mock.calls[0][0]).toBe("bar")
      expect(handler1.mock.calls[0][1]).toBe(`${testTopic}/foo`)
      expect(handler2.mock.calls[0][0]).toBe(23)
      expect(handler2.mock.calls[0][1]).toBe(`${testTopic}/baz`)
    })

    test("should retrieve non-retained messages", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await client.subscribe(eventTopic, handler)
      await client.publish(eventTopic, "hello")

      await delayUntil(() => handler.mock.calls.length === 1)

      expect(handler.mock.calls[0][0]).toBe("hello")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
    })

    test("should receive messages with empty payload", async () => {
      const handler = jest.fn()

      await client.subscribe(`${testTopic}/foo`, handler)
      await client.unpublish(`${testTopic}/foo`)

      await delayUntil(() => handler.mock.calls.length === 2)

      expect(handler.mock.calls[0][0]).toBe("bar")
      expect(handler.mock.calls[0][1]).toBe(`${testTopic}/foo`)
      expect(handler.mock.calls[1][0]).toBe(undefined)
      expect(handler.mock.calls[1][1]).toBe(`${testTopic}/foo`)
    })

    test("should retrieve retained messages using hash wildcard", async () => {
      const handler = jest.fn()
      await client.subscribe(`${testTopic}/#`, handler)

      await delayUntil(() => handler.mock.calls.length === 2)

      if (handler.mock.calls[0][1] === `${testTopic}/baz`) {
        expect(handler.mock.calls[0][0]).toBe(23)
        expect(handler.mock.calls[0][1]).toBe(`${testTopic}/baz`)
        expect(handler.mock.calls[1][0]).toBe("bar")
        expect(handler.mock.calls[1][1]).toBe(`${testTopic}/foo`)
      } else {
        expect(handler.mock.calls[0][0]).toBe("bar")
        expect(handler.mock.calls[0][1]).toBe(`${testTopic}/foo`)
        expect(handler.mock.calls[1][0]).toBe(23)
        expect(handler.mock.calls[1][1]).toBe(`${testTopic}/baz`)
      }
    })

    test("should retrieve retained messages using plus wildcard", async () => {
      const handler = jest.fn()
      await client.subscribe(`${testTopic}/+`, handler)

      await delayUntil(() => handler.mock.calls.length === 2)

      if (handler.mock.calls[0][1] === `${testTopic}/foo`) {
        expect(handler.mock.calls[0][0]).toBe("bar")
        expect(handler.mock.calls[0][1]).toBe(`${testTopic}/foo`)
        expect(handler.mock.calls[1][0]).toBe(23)
        expect(handler.mock.calls[1][1]).toBe(`${testTopic}/baz`)
      } else {
        expect(handler.mock.calls[0][0]).toBe(23)
        expect(handler.mock.calls[0][1]).toBe(`${testTopic}/baz`)
        expect(handler.mock.calls[1][0]).toBe("bar")
        expect(handler.mock.calls[1][1]).toBe(`${testTopic}/foo`)
      }
    })

    test("should ignore malformed JSON payloads", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await client.subscribe(eventTopic, handler)

      await client.client.publish(eventTopic, "this is invalid JSON")
      await client.client.publish(eventTopic, "42")

      await delayUntil(() => handler.mock.calls.length === 1)

      expect(handler.mock.calls[0][0]).toBe(42)
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(onParseError.mock.calls[0][0]).toEqual(Buffer.from("this is invalid JSON"))
      expect(onParseError.mock.calls[0][1]).toBe(eventTopic)
    })

    test("should receive raw payload when JSON parsing is disabled", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await client.subscribe(eventTopic, handler, { parseJson: false })

      await client.client.publish(eventTopic, "this is invalid JSON")
      await client.client.publish(eventTopic, "42")

      await delayUntil(() => handler.mock.calls.length === 2)

      expect(handler.mock.calls[0][0]).toBe("this is invalid JSON")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(handler.mock.calls[1][0]).toBe("42")
      expect(handler.mock.calls[1][1]).toBe(eventTopic)
    })

    test("should not receive messages after unsubscribing", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await client.subscribe(eventTopic, handler)

      await client.publish(eventTopic, "hello")

      await delayUntil(() => handler.mock.calls.length === 1)

      await client.unsubscribe(eventTopic, handler)

      await client.publish(eventTopic, "goodbye")

      await client.subscribe(eventTopic, handler)

      await client.publish(eventTopic, "hello again")

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

      await client.subscribe(eventTopic, handler)

      await client.publish(eventTopic, "hello")

      await delayUntil(() => handler.mock.calls.length === 1)

      expect(handler.mock.calls[0][0]).toBe("hello")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(handler.mock.calls[0][2].qos).toBe(2)
    })

    test("should override QoS", async () => {
      const handler = jest.fn()
      const eventTopic = `${testTopic}/onEvent`

      await client.subscribe(eventTopic, handler)

      await client.publish(eventTopic, "hello", { qos: 0 })

      await delayUntil(() => handler.mock.calls.length === 1)

      expect(handler.mock.calls[0][0]).toBe("hello")
      expect(handler.mock.calls[0][1]).toBe(eventTopic)
      expect(handler.mock.calls[0][2].qos).toBe(0)
    })

    test("should publish messages without stringifying", async () => {
      const topic = `${testTopic}/raw`

      await client.publish(topic, "invalid\nJSON", { stringifyJson: false })

      const response = await client.query({ topic, parseJson: false })
      expect(response).toEqual({ topic, payload: "invalid\nJSON" })
    })

    test("should unpublish messages", async () => {
      await client.unpublish(`${testTopic}/foo`)

      const response = await client.query({ topic: testTopic, depth: 1 })
      expect(response).toEqual({
        topic: testTopic,
        children: [{ topic: `${testTopic}/baz`, payload: 23 }]
      })
    })

    test("should unpublish messages recursively", async () => {
      expect.assertions(1)

      await client.unpublishRecursively(`${testTopic}`)

      await client.query({ topic: testTopic }).catch(error => {
        expect(error).toEqual({ topic: testTopic, error: 404 })
      })
    })
  })
})
