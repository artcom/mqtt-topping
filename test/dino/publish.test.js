const { connectAsync, HttpClient, unpublishRecursively } = require("../../lib/main")
const { delay, delayUntil } = require("../util")

const tcpBrokerUri = process.env.HTTP_BROKER_URI || "tcp://127.0.0.1:1883"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://127.0.0.1:8080"

describe("MQTT Publish Test", () => {
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

    testTopic = `test-dino-stringify/topping-${Math.random()}`

    await mqttClient.publish(`${testTopic}/foo`, "bar")
    await mqttClient.publish(`${testTopic}/baz`, 23)

    // ensure that the publishes are processed on the server before testing
    await delay(100)
  })

  afterEach(async () => {
    await unpublishRecursively(mqttClient, httpClient, testTopic)
    mqttClient.disconnect()
  })

  describe("publish", () => {
    test.only("should publish messages without stringifying", async () => {
      const topic = `${testTopic}/raw`
      const furz = `${testTopic}/furz`

      await mqttClient.publish(topic, "invalid\nJSON", { stringifyJson: false })
      await mqttClient.publish(furz, "dino")

      const response = await httpClient.query({ topic, parseJson: false })
      const response2 = await httpClient.query({ topic: furz })
      console.info("response", response)
      console.info("response2", response2)
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
  })
})
