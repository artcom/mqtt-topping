const { delay } = require("./util")
const { connectAsync, HttpClient, unpublishRecursively } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://127.0.0.1"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://127.0.0.1:8080"

describe("HTTP Query JSON API", () => {
  let mqttClient
  let httpClient
  let testTopic
  const [major] = process.versions.node.split(".").map(Number)

  beforeEach(async () => {
    mqttClient = await connectAsync(tcpBrokerUri)
    httpClient = new HttpClient(httpBrokerUri)

    testTopic = `test/topping-${Math.random()}`

    await Promise.all([
      mqttClient.publish(`${testTopic}/valid/array`, ["a", "b", "c"]),
      mqttClient.publish(`${testTopic}/valid/nested1/one`, 1),
      mqttClient.publish(`${testTopic}/valid/nested1/two`, 2),
      mqttClient.publish(`${testTopic}/valid/nested2`, "valid"),
      mqttClient.publish(`${testTopic}/valid/nested2/one`, 10),
      mqttClient.publish(`${testTopic}/valid/nested3/one`, 100),
      mqttClient.publish(`${testTopic}/valid/string`, "bar"),
      mqttClient.publish(`${testTopic}/invalid/payload`, "invalid", { stringifyJson: false }),
    ])

    // ensure that the publishes are processed on the server before testing
    await delay(100)
  })

  afterEach(async () => {
    await unpublishRecursively(mqttClient, httpClient, testTopic)
    mqttClient.disconnect()
  })

  describe("Single Queries", () => {
    test("should return a nested object with all children", async () => {
      const response = await httpClient.queryJson(`${testTopic}/valid`)

      expect(response).toEqual({
        string: "bar",
        array: ["a", "b", "c"],
        nested1: {
          one: 1,
          two: 2,
        },
        nested2: {
          one: 10,
        },
        nested3: {
          one: 100,
        },
      })
    })

    test("should return payload for a leaf topic", async () => {
      const response = await httpClient.queryJson(`${testTopic}/valid/string`)
      expect(response).toBe("bar")
    })

    test("should throw for inexistent topic", async () =>
      expect(httpClient.queryJson(`${testTopic}/does-not-exist`)).rejects.toThrow(
        new Error(
          JSON.stringify({
            error: 404,
            topic: `${testTopic}/does-not-exist`,
          }),
          null,
          2,
        ),
      ))

    test("should throw on invalid payloads", async () => {
      const invalidPayloadErrorMessage =
        major >= 20
          ? "Unexpected token 'i', \"invalid\" is not valid JSON"
          : "Unexpected token i in JSON at position 0"

      await expect(httpClient.queryJson(`${testTopic}/invalid`)).rejects.toThrow(
        new Error(invalidPayloadErrorMessage),
      )
    })

    test("should throw for wildcard queries", () =>
      expect(httpClient.queryJson(`${testTopic}/valid/+`)).rejects.toThrow(
        new Error("Wildcards are not supported in queryJson()."),
      ))
  })

  describe("Batch Queries", () => {
    test("should query multiple topics", async () => {
      const response = await httpClient.queryJsonBatch([
        `${testTopic}/valid/nested1`,
        `${testTopic}/valid/nested2`,
      ])

      expect(response).toEqual([
        {
          one: 1,
          two: 2,
        },
        {
          one: 10,
        },
      ])
    })

    test("should throw for wildcard queries", async () =>
      expect(
        httpClient.queryJsonBatch([`${testTopic}/valid/+`, `${testTopic}/valid/nested1`]),
      ).rejects.toThrow(new Error("Wildcards are not supported in queryJson().")))

    test("should include errors for non-existing topics", async () => {
      const response = await httpClient.queryJsonBatch([
        `${testTopic}/valid/nested1`,
        `${testTopic}/does-not-exist`,
      ])

      expect(response).toEqual([
        {
          one: 1,
          two: 2,
        },
        new Error(JSON.stringify({ error: 404, topic: `${testTopic}/does-not-exist` })),
      ])
    })
  })
})
