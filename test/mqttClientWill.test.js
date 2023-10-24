const { delay } = require("./util")
const { connectAsync, HttpClient, unpublishRecursively } = require("../lib/main")

const tcpBrokerUri = process.env.TCP_BROKER_URI || "tcp://127.0.0.1"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://127.0.0.1:8080"

describe("MQTT Client Will", () => {
  let mqttClient
  let httpClient
  let testTopic

  beforeEach(async () => {
    httpClient = new HttpClient(httpBrokerUri)
    testTopic = `test/topping-${Math.random()}`
  })

  afterEach(async () => {
    const client = await connectAsync(tcpBrokerUri, { appId: "Test", deviceId: "DeviceId" })
    await unpublishRecursively(client, httpClient, testTopic)
    client.disconnect()
  })

  test("should publish last will on timeout", async () => {
    const willTopic = `${testTopic}/lastWill`
    const willPayload = { foo: "bar" }

    mqttClient = await connectAsync(tcpBrokerUri, {
      appId: "Test",
      deviceId: "DeviceId",
      connectTimeout: 500,
      will: {
        topic: willTopic,
        payload: willPayload,
        retain: true,
      },
    })

    mqttClient.client.stream.destroy()
    mqttClient.disconnect()

    // ensure that the timeout applies on the server
    await delay(1000)

    const response = await httpClient.query({ topic: willTopic })
    expect(response).toEqual({ topic: willTopic, payload: willPayload })
  })

  test("should publish last will without stringify", async () => {
    const willTopic = `${testTopic}/lastWill`
    const willPayload = "raw_text"

    mqttClient = await connectAsync(tcpBrokerUri, {
      appId: "Test",
      deviceId: "DeviceId",
      connectTimeout: 500,
      will: {
        topic: willTopic,
        payload: willPayload,
        stringifyJson: false,
        retain: true,
      },
    })

    mqttClient.client.stream.destroy()
    mqttClient.disconnect()

    // ensure that the timeout applies on the server
    await delay(1000)

    const response = await httpClient.query({ topic: willTopic, parseJson: false })
    expect(response).toEqual({ topic: willTopic, payload: "raw_text" })
  })
})
