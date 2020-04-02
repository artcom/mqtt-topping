const { delay } = require("./util")
const { connectMqttClient, HttpClient, unpublishRecursively } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080/query"

describe("HTTP Query JSON API", () => {
  let mqttClient
  let httpClient
  let testTopic

  beforeEach(async () => {
    mqttClient = await connectMqttClient(tcpBrokerUri)
    httpClient = new HttpClient(httpBrokerUri)

    testTopic = `test/topping-${Math.random()}`

    await Promise.all([
      mqttClient.publish(`${testTopic}/array`, ["a", "b", "c"]),
      mqttClient.publish(`${testTopic}/nested1/one`, 1),
      mqttClient.publish(`${testTopic}/nested1/two`, 2),
      mqttClient.publish(`${testTopic}/nested2`, "valid"),
      mqttClient.publish(`${testTopic}/nested2/one`, 10),
      mqttClient.publish(`${testTopic}/nested3/one`, 100),
      mqttClient.publish(`${testTopic}/string`, "bar")
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
      const response = await httpClient.queryJson(testTopic)

      expect(response).toEqual({
        string: "bar",
        array: ["a", "b", "c"],
        nested1: {
          one: 1,
          two: 2
        },
        nested2: {
          one: 10
        },
        nested3: {
          one: 100
        }
      })
    })

    test("should return payload for a leaf topic", async () => {
      const response = await httpClient.queryJson(`${testTopic}/string`)
      expect(response).toBe("bar")
    })

    test("should throw for inexistent topic", async () => {
      expect.assertions(1)

      await httpClient.queryJson(`${testTopic}/does-not-exist`).catch(error =>
        expect(error).toEqual({
          topic: `${testTopic}/does-not-exist`,
          error: 404
        })
      )
    })

    test("should throw for wildcard queries", () => {
      expect.assertions(1)

      return httpClient.queryJson(`${testTopic}/+`).catch(error =>
        expect(error).toEqual(new Error("Wildcards are not supported in queryJson()."))
      )
    })
  })

  describe("Batch Queries", () => {
    test("should query multiple topics", async () => {
      const response = await httpClient.queryJsonBatch([
        `${testTopic}/nested1`,
        `${testTopic}/nested2`,
        `${testTopic}/does-not-exist`
      ])

      expect(response).toEqual([
        {
          one: 1,
          two: 2
        },
        {
          one: 10
        },
        {
          topic: `${testTopic}/does-not-exist`,
          error: 404
        }
      ])
    })

    test("should throw for wildcard queries", async () => {
      expect.assertions(1)

      return httpClient.queryJsonBatch([
        `${testTopic}/+`,
        `${testTopic}/nested1`
      ]).catch(error =>
        expect(error).toEqual(new Error("Wildcards are not supported in queryJson()."))
      )
    })
  })
})
