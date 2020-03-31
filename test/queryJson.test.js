const { delay } = require("./util")
const topping = require("../lib/main")

const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://localhost:8080/query"
const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://localhost"

describe("JSON Query API", () => {
  let client
  let testTopic

  beforeEach(async () => {
    client = await topping.connect(tcpBrokerUri, httpBrokerUri)
    testTopic = `test/topping-${Date.now()}`

    await Promise.all([
      client.publish(`${testTopic}/array`, ["a", "b", "c"]),
      client.publish(`${testTopic}/nested1/one`, 1),
      client.publish(`${testTopic}/nested1/two`, 2),
      client.publish(`${testTopic}/nested1/three`, "invalid", { stringifyJson: false }),
      client.publish(`${testTopic}/nested2`, "valid"),
      client.publish(`${testTopic}/nested2/one`, 10),
      client.publish(`${testTopic}/nested3`, "invalid", { stringifyJson: false }),
      client.publish(`${testTopic}/nested3/one`, 100),
      client.publish(`${testTopic}/string`, "bar")
    ])

    // ensure that the publishes are processed on the server before testing
    await delay(100)
  })

  afterEach(async () => {
    await client.unpublishRecursively(testTopic)
    client.disconnect()
  })

  describe("Single Queries", () => {
    test("should return a nested object with all children", async () => {
      const response = await client.queryJson({ topic: testTopic })

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

    test("should return an empty object for leaf topics", async () => {
      const response = await client.queryJson({ topic: `${testTopic}/string` })
      expect(response).toEqual({})
    })

    test("should return an empty object for inexistent topic", async () => {
      const response = await client.queryJson({ topic: `${testTopic}/does-not-exist` })
      expect(response).toEqual({})
    })

    test("should throw for wildcard queries", () => {
      expect.assertions(1)

      return client.queryJson({ topic: `${testTopic}/+` }).catch(error =>
        expect(error).toEqual(new Error("Wildcards are not supported in queryJson()."))
      )
    })
  })

  describe("Batch Queries", () => {
    test("should query multiple topics", async () => {
      const response = await client.queryJsonBatch([
        { topic: `${testTopic}/nested1` },
        { topic: `${testTopic}/nested2` },
        { topic: `${testTopic}/does-not-exist` }
      ])

      expect(response).toEqual([
        {
          one: 1,
          two: 2
        },
        {
          one: 10
        },
        {}
      ])
    })

    test("should throw for wildcard queries", async () => {
      expect.assertions(1)

      return client.queryJsonBatch([
        { topic: `${testTopic}/+` },
        { topic: `${testTopic}/nested1` }
      ]).catch(error =>
        expect(error).toEqual(new Error("Wildcards are not supported in queryJson()."))
      )
    })
  })
})
