const { delay } = require("./util")
const topping = require("../lib/main")

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080/query"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"

describe("HTTP Query API", () => {
  let client
  let testTopic

  beforeEach(async () => {
    client = await topping.connect(tcpBrokerUri, httpBrokerUri)
    testTopic = `test/topping-${Date.now()}`

    await client.publish(`${testTopic}/foo`, "bar")
    await client.publish(`${testTopic}/baz`, 23)
    await client.publish(`${testTopic}/more/one`, 1)
    await client.publish(`${testTopic}/more/two`, 2)

    // ensure that the publishes are processed on the server before testing
    await delay(100)
  })

  afterEach(async () => {
    await client.unpublishRecursively(testTopic)
    client.disconnect()
  })

  describe("Single Queries", () => {
    test("should query single topics", async () => {
      const response = await client.query({ topic: `${testTopic}/foo` })

      expect(response).toEqual({
        topic: `${testTopic}/foo`,
        payload: "bar"
      })
    })

    test("should query wildcard topics", async () => {
      const response = await client.query({ topic: `${testTopic}/+` })

      expect(response).toEqual([
        { topic: `${testTopic}/baz`, payload: 23 },
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/more` }
      ])
    })

    test("should query subtopics", async () => {
      const response = await client.query({ topic: `${testTopic}/more`, depth: 1 })

      expect(response).toEqual({
        topic: `${testTopic}/more`,
        children: [
          { topic: `${testTopic}/more/one`, payload: 1 },
          { topic: `${testTopic}/more/two`, payload: 2 }
        ]
      })
    })

    test("should query subtopics with grandchildren", async () => {
      const response = await client.query({ topic: testTopic, depth: 2 })

      expect(response).toEqual({
        topic: testTopic,
        children: [
          {
            topic: `${testTopic}/baz`,
            payload: 23
          },
          {
            topic: `${testTopic}/foo`,
            payload: "bar"
          },
          {
            topic: `${testTopic}/more`,
            children: [
              { topic: `${testTopic}/more/one`, payload: 1 },
              { topic: `${testTopic}/more/two`, payload: 2 }
            ]
          }
        ]
      })
    })

    test("should flatten query results", async () => {
      const response = await client.query({ topic: testTopic, depth: 2, flatten: true })
      return expect(response).toEqual([
        { topic: testTopic },
        { topic: `${testTopic}/baz`, payload: 23 },
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/more` },
        { topic: `${testTopic}/more/one`, payload: 1 },
        { topic: `${testTopic}/more/two`, payload: 2 }
      ])
    })

    test("should fail when querying an inexistent topic", async () => {
      expect.assertions(1)
      await client.query({ topic: `${testTopic}/does-not-exist` })
        .catch(error => {
          expect(error).toEqual({
            topic: `${testTopic}/does-not-exist`,
            error: 404
          })
        })
    })
  })

  describe("Batch Queries", () => {
    test("should query multiple topics", async () => {
      const response = await client.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/baz` }
      ])

      expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/baz`, payload: 23 }
      ])
    })

    test("should include errors in the results", async () => {
      const response = await client.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/does-not-exist` }
      ])

      expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/does-not-exist`, error: 404 }
      ])
    })
  })

  describe("JSON Parsing", () => {
    beforeEach(async () => {
      await client.client.publish(`${testTopic}/invalid`, "this is invalid JSON", { retain: true })
    })

    test("should fail on invalid payloads", async () => {
      expect.assertions(1)

      await client.query({ topic: `${testTopic}/invalid` }).catch(error =>
        expect(error).toEqual("Unexpected token h in JSON at position 1")
      )
    })

    test("should represent errors in batch queries", async () => {
      const response = await client.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/invalid` }
      ])

      return expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/invalid`, error: new SyntaxError("Unexpected token h in JSON at position 1") }
      ])
    })

    test("can be disabled in single queries", async () => {
      const response = await client.query({ topic: `${testTopic}/invalid`, parseJson: false })
      expect(response).toEqual({
        topic: `${testTopic}/invalid`,
        payload: "this is invalid JSON"
      })
    })

    test("can be disabled in batch queries", async () => {
      const response = await client.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/invalid`, parseJson: false }
      ])

      expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/invalid`, payload: "this is invalid JSON" }
      ])
    })
  })
})
