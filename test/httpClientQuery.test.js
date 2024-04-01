const { delay } = require("./util")
const { connectAsync, HttpClient, unpublishRecursively } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://127.0.0.1"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://127.0.0.1:8080"

describe("HTTP Query API", () => {
  let mqttClient
  let httpClient
  let testTopic
  const [major] = process.versions.node.split(".").map(Number)

  beforeEach(async () => {
    mqttClient = await connectAsync(tcpBrokerUri)
    httpClient = new HttpClient(httpBrokerUri)

    testTopic = `test/topping-${Math.random()}`

    await mqttClient.publish(`${testTopic}/foo`, "bar")
    await mqttClient.publish(`${testTopic}/baz`, 23)
    await mqttClient.publish(`${testTopic}/more/one`, 1)
    await mqttClient.publish(`${testTopic}/more/two`, 2)

    // ensure that the publishes are processed on the server before testing
    await delay(100)
  })

  afterEach(async () => {
    await unpublishRecursively(mqttClient, httpClient, testTopic)
    mqttClient.disconnect()
  })

  describe("Single Queries", () => {
    test("should query single topics", async () => {
      const response = await httpClient.query({ topic: `${testTopic}/foo` })

      expect(response).toEqual({
        topic: `${testTopic}/foo`,
        payload: "bar",
      })
    })

    test("should query wildcard topics", async () => {
      const response = await httpClient.query({ topic: `${testTopic}/+` })

      expect(response).toEqual([
        { topic: `${testTopic}/baz`, payload: 23 },
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/more` },
      ])
    })

    test("should query subtopics", async () => {
      const response = await httpClient.query({ topic: `${testTopic}/more`, depth: 1 })

      expect(response).toEqual({
        topic: `${testTopic}/more`,
        children: [
          { topic: `${testTopic}/more/one`, payload: 1 },
          { topic: `${testTopic}/more/two`, payload: 2 },
        ],
      })
    })

    test("should query subtopics with grandchildren", async () => {
      const response = await httpClient.query({ topic: testTopic, depth: 2 })

      expect(response).toEqual({
        topic: testTopic,
        children: [
          {
            topic: `${testTopic}/baz`,
            payload: 23,
          },
          {
            topic: `${testTopic}/foo`,
            payload: "bar",
          },
          {
            topic: `${testTopic}/more`,
            children: [
              { topic: `${testTopic}/more/one`, payload: 1 },
              { topic: `${testTopic}/more/two`, payload: 2 },
            ],
          },
        ],
      })
    })

    test("should flatten query results", async () => {
      const response = await httpClient.query({ topic: testTopic, depth: 2, flatten: true })
      return expect(response).toEqual([
        { topic: testTopic },
        { topic: `${testTopic}/baz`, payload: 23 },
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/more` },
        { topic: `${testTopic}/more/one`, payload: 1 },
        { topic: `${testTopic}/more/two`, payload: 2 },
      ])
    })

    test("should fail when querying an inexistent topic", async () =>
      expect(httpClient.query({ topic: `${testTopic}/does-not-exist` })).rejects.toThrow(
        new Error(
          JSON.stringify({
            error: 404,
            topic: `${testTopic}/does-not-exist`,
          })
        )
      ))
  })

  describe("Batch Queries", () => {
    test("should query multiple topics", async () => {
      const response = await httpClient.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/baz` },
      ])

      expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/baz`, payload: 23 },
      ])
    })

    test("should include errors for non-existing topics", async () => {
      const response = await httpClient.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/does-not-exist` },
      ])

      expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        new Error(JSON.stringify({ error: 404, topic: `${testTopic}/does-not-exist` })),
      ])
    })
  })

  describe("JSON Parsing", () => {
    const error =
      major >= 20
        ? "Unexpected token 'h', \"this is invalid JSON\" is not valid JSON"
        : "Unexpected token h in JSON at position 1"

    beforeEach(async () => {
      await mqttClient.publish(`${testTopic}/invalid`, "this is invalid JSON", {
        stringifyJson: false,
      })
    })

    test("should fail on invalid payloads", async () => {
      await expect(httpClient.query({ topic: `${testTopic}/invalid` })).rejects.toThrow(
        new Error(error)
      )
    })

    test("should represent errors in batch queries", async () => {
      const response = await httpClient.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/invalid` },
      ])

      return expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        new Error(
          JSON.stringify({
            error,
            topic: `${testTopic}/invalid`,
          })
        ),
      ])
    })

    test("can be disabled in single queries", async () => {
      const response = await httpClient.query({ topic: `${testTopic}/invalid`, parseJson: false })
      expect(response).toEqual({
        topic: `${testTopic}/invalid`,
        payload: "this is invalid JSON",
      })
    })

    test("can be disabled in batch queries", async () => {
      const response = await httpClient.queryBatch([
        { topic: `${testTopic}/foo` },
        { topic: `${testTopic}/invalid`, parseJson: false },
      ])

      expect(response).toEqual([
        { topic: `${testTopic}/foo`, payload: "bar" },
        { topic: `${testTopic}/invalid`, payload: "this is invalid JSON" },
      ])
    })
  })
})
