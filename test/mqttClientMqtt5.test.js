const { delay } = require("./util")
const { connectAsync, HttpClient, unpublishRecursively } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://127.0.0.1"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://127.0.0.1:8080"

describe("MQTT5 Client features", () => {
  let mqttClient
  let httpClient
  let rootTopic
  let onParseError

  beforeEach(async () => {
    onParseError = jest.fn()

    mqttClient = await connectAsync(tcpBrokerUri, {
      onParseError,
      appId: "Test",
      deviceId: "DeviceId",
      protocolVersion: 5,
    })

    httpClient = new HttpClient(httpBrokerUri)

    rootTopic = `test/topping-${Math.random()}`
  })

  afterEach(async () => {
    await unpublishRecursively(mqttClient, httpClient, rootTopic)
    mqttClient.disconnect()
  })

  test("should publish message with response topic", async () => {
    expect.assertions(3)

    const testTopic = `${rootTopic}/testTopic`
    const testPayload = "payload"
    const responseTopic = `${testTopic}/testTopicResponse`

    const handler = (payload, topic, packet) => {
      expect(topic).toEqual(testTopic)
      expect(payload).toEqual(testPayload)
      expect(packet.properties.responseTopic).toEqual(responseTopic)
    }

    await mqttClient.subscribe(testTopic, handler)

    await mqttClient.publish(testTopic, testPayload, { properties: { responseTopic } })

    await delay(100)

    await mqttClient.unsubscribe(testTopic, handler)
  })

  test("should publish message with correlation data", async () => {
    expect.assertions(3)

    const testTopic = `${rootTopic}/testTopic`
    const testPayload = "payload"
    const correlationData = Buffer.from(`${Math.random()}`)

    const handler = (payload, topic, packet) => {
      expect(topic).toEqual(testTopic)
      expect(payload).toEqual(testPayload)
      expect(packet.properties.correlationData).toEqual(correlationData)
    }

    await mqttClient.subscribe(testTopic, handler)

    await mqttClient.publish(testTopic, testPayload, { properties: { correlationData } })

    await delay(100)

    await mqttClient.unsubscribe(testTopic, handler)
  })
})
