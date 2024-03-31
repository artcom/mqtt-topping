const { delay, delayUntil } = require("../util")
const { connectAsync, HttpClient, unpublishRecursively } = require("../../lib/main")

const tcpBrokerUri = process.env.HTTP_BROKER_URI || "tcp://127.0.0.1:1883"
const httpBrokerUri = process.env.HTTP_BROKER_URI || "http://127.0.0.1:8080"

describe("MQTT and HTTP Integration Test", () => {
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
    console.info("httpClient", httpClient)
    testTopic = `test/topic-${Math.random()}`
  })

  afterEach(async () => {
    // await unpublishRecursively(mqttClient, httpClient, "test")
    // await unpublishRecursively(mqttClient, httpClient, "my")
    mqttClient.disconnect()
  })

  test("should publish a topic and query it", async () => {
    // Publish a message to the test topic
    await mqttClient.publish(testTopic, "Test message")
    await mqttClient.publish("my/topic", "myPayload")
    await mqttClient.publish(`${testTopic}/foo`, "bar")
    await mqttClient.publish(`${testTopic}/baz`, 23)
    await mqttClient.publish(`${testTopic}/more/one`, 1)
    await mqttClient.publish(`${testTopic}/more/two`, 2)

    // Delay to ensure the message is processed by the broker and HTTP server
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Query the published message using the HTTP client
    const queryResult = await httpClient.query({ topic: `${testTopic}/foo` })
    console.info("queryResult", queryResult)

    expect(queryResult).toEqual({
      topic: testTopic,
      payload: "Test message",
    })
  })

  // {
  // "topic": "my",
  // "children": [
  //     {
  //         "topic": "my/topic",
  //         "payload": "myPayload" // payload is empty, is missing
  //     }
  //   ]
  // }

  // wait a few milliseconds to ensure the data is processed on the server

  // Check if the query result matches the expected outcome
})
