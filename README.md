# mqtt-topping

Wraps the MQTT.js client to multiplex incoming messages to the subscribed handlers and supports querying retained topics via HTTP.

[MQTT.js events](https://github.com/mqttjs/MQTT.js#event-connect) can also be registered on the mqtt-topping client.

Expects that the default MQTT message payload is formatted as JSON.

## MQTT Client

### Features

* Subscribe and unsubscribe handler callbacks to individual (wildcard) topics
* `JSON.stringify` all published payloads
* `JSON.parse` all incoming payloads
* Ignore non-JSON payloads
* Decide whether to retain a message or not depending on the topic name (retained unless topic is prefixed with `on` or `do`)
* Publishes and subscriptions are sent with quality-of-service 2

### Connect, Subscribe, Publish, Unpublish and Register Event "offline"

```javascript
const { connectAsync } = require("@artcom/mqtt-topping")

async function main() {
  const client = await connectAsync("tcp://broker.example.com")

  client.on("offline", () => console.error("Client is offline. Trying to reconnect."))

  await client.subscribe("my/topic", (payload, topic, packet) => {
    console.log("Received Payload " + payload +
                " for Topic " + topic +
                " (retained = " + packet.retain + ")")
  })

  await client.publish("my/topic", "myPayload")
  
  await client.unpublish("my/topic")
}
```

## HTTP Client

### Features

* Works with the broker plugin ["HiveMQ Retained Message Query Plugin"](https://github.com/artcom/hivemq-retained-message-query-plugin)
* Supports single and batch queries including wildcard topics, additional options are:
  * `parseJson`: Parse the `result.payload` as JSON. Default is `true`.
  * `depth`: Specifies the recursive depth of the query. A `depth > 0` returns subtopics in `result.children`. Default is `0`.
  * `flatten`: Flattens all topics into a flat array. Default is `false`.
* Supports single and batch json queries which:
  * return entire topic trees (topics with subtopics) as one JSON object
  * ignore topic payloads if subtopics exist

### Single Query

```javascript
const { connectAsync, HttpClient } = require("@artcom/mqtt-topping")

async function main() {
  const client = await connectAsync("tcp://broker.example.com")
  const httpClient = new HttpClient("http://broker.example.com/query")

  await client.publish("my/topic", "myPayload")

  // wait a few milliseconds to ensure the data is processed on the server

  const result = await httpClient.query({ topic: "my", depth: 1 })
  
  // {
  // "topic": "my",
  // "children": [
  //     {
  //         "topic": "my/topic",
  //         "payload": "myPayload"
  //     }
  //   ]
  // }
}
```

### Batch Query

```javascript
const { connectAsync, HttpClient } = require("@artcom/mqtt-topping")

async function main() {
  const client = await connectAsync("tcp://broker.example.com")
  const httpClient = new HttpClient("http://broker.example.com/query")

  await client.publish("my/topic1", "myPayload1")
  await client.publish("my/topic2", "myPayload2")

  // wait a few milliseconds to ensure the data is processed on the server

  const result = await httpClient.queryBatch([{ topic: "my/topic1" }, { topic: "my/topic2" }])

  // [
  //   {
  //       "topic": "my/topic1",
  //       "payload": "myPayload1"
  //   },
  //   {
  //       "topic": "my/topic2",
  //       "payload": "myPayload2"
  //   }
  // ]
}
```

### QueryJson

```javascript
const { connectAsync, HttpClient } = require("@artcom/mqtt-topping")

async function main() {
  const client = await connectAsync("tcp://broker.example.com")
  const httpClient = new HttpClient("http://broker.example.com/query")

  await client.publish("my/topic", "myPayload")

  // wait a few milliseconds to ensure the data is processed on the server

  const result = await httpClient.queryJson("my")
  
  // {
  //   "topic": "myPayload"
  // }
}
```

### QueryJsonBatch

```javascript
const { connectAsync, HttpClient } = require("@artcom/mqtt-topping")

async function main() {
  const client = await connectAsync("tcp://broker.example.com")
  const httpClient = new HttpClient("http://broker.example.com/query")

  await client.publish("january/first", "eat")
  await client.publish("january/second", "sleep")
  await client.publish("february/first", "work")
  await client.publish("february/second", "repeat")

  // wait a few milliseconds to ensure the data is processed on the server

  const result = await httpClient.queryJsonBatch(["january", "february"])
  
  // [
  //   {
  //     "first": "eat"
  //     "second": "sleep"
  //   },
  //   {
  //     "first": "work"
  //     "second": "repeat"
  //   }
  // ]
}
```

### Unpublish Recusrively

```javascript
const { connectAsync, HttpClient, unpublishRecursively } = require("@artcom/mqtt-topping")

async function main() {
  const client = await connectAsync("tcp://broker.example.com")
  const httpClient = new HttpClient("http://broker.example.com/query")

  await client.publish("january/first", "eat")
  await client.publish("january/second", "sleep")
  await client.publish("february/first", "work")
  await client.publish("february/second", "repeat")

  // wait a few milliseconds to ensure the data is processed on the server

  const result = await unpublishRecursively(mqttClient, httpClient, "february")
  
  // remaining published topics on the broker
  // january/first: "eat"
  // january/second: "sleep"
}
```

## Development

### Build

```bash
npm install
npm run build
```

### Test

The tests require a running MQTT broker instance with the ["HiveMQ Retained Message Query Plugin"](https://github.com/artcom/hivemq-retained-message-query-plugin).

```bash
npm install
npm run test
```
