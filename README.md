# MQTT Topping

**mqtt-topping** provides two primary, modern TypeScript components designed for robust MQTT interactions and related data retrieval:

1. **`MqttClient`**: A feature-rich, promise-based wrapper around [MQTT.js](https://github.com/mqttjs/MQTT.js) offering enhanced capabilities like flexible payload parsing, multiple handlers per topic, wildcard support, simplified subscription management, and utilities like retained message clearing. Built for ESM environments.
2. **`HttpClient`**: A companion client for querying MQTT-like hierarchical data exposed over an HTTP/JSON endpoint, supporting single/batch queries and JSON parsing.

## HiveMQ Retained Message Query Plugin

The HTTP querying features in `mqtt-topping` are designed to work with the [HiveMQ Retained Message Query Plugin](https://github.com/artcom/hivemq-retained-message-query-plugin). This HiveMQ extension exposes an HTTP API (by default at the `/query` route) for querying retained MQTT messages directly from the broker, without using MQTT subscriptions.

- The `/query` endpoint and its behavior (including support for `topic`, `depth`, `flatten`, and limited wildcards) are specific to this plugin. See the plugin's [README](https://github.com/artcom/hivemq-retained-message-query-plugin) for details and configuration options.
- Batch queries and flattened results are supported as described in the plugin documentation.
- The HTTP API is not a standard MQTT feature; it requires the plugin to be installed and enabled on your HiveMQ broker.

### Non-Retained Topics: 'on' and 'do' Prefixes

By convention, topics starting with `on` or `do` followed by an uppercase letter (e.g., `onUpdate`, `doAction`) are treated as event or command topics and are **not retained** by default when publishing. This helps prevent accidental retention of transient messages. The plugin and `mqtt-topping` both respect this convention for safer MQTT usage.

---

## Features

- **Promise-Based API**: Async operations (`connect`, `publish`, `subscribe`, `unsubscribe`, etc.) return Promises for cleaner async/await flows.
- **Flexible Payload Handling**:
  - Automatic JSON parsing/stringifying by default.
  - Support for `string`, `buffer`, or `custom` parsers via `parseType` options.
- **Enhanced Subscriptions**:
  - Attach multiple callback handlers to the same topic or wildcard.
  - Reliable wildcard (`+`, `#`) matching for topic subscriptions.
  - Simplified `unsubscribe` (removes specific handler) and `forceUnsubscribe` (removes all handlers for a topic).
- **MQTT Utilities**: Includes `unpublish` to easily clear retained messages.
- **HTTP Client**: Retrieve MQTT topic data via HTTP using `HttpClient` for scenarios where MQTT data is exposed via a web API. Supports depth, flattening, and batching.
- **Robust Error Handling**: Provides a hierarchy of custom error types (`MqttError`, `HttpError`, etc.) for better error identification.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
  - [MqttClient Example](#mqttclient-example)
  - [HttpClient Example](#httpclient-example)
- [MqttClient In-Depth](#mqttclient-in-depth)
  - [Connection](#connection)
  - [Subscribing](#subscribing)
  - [Publishing](#publishing)
  - [Unsubscribing](#unsubscribing)
  - [Clearing Retained Messages (`unpublish`)](#clearing-retained-messages-unpublish)
  - [Payload Parsing (`parseType`)](#payload-parsing-parsetype)
  - [Error Handling (`onParseError` & Async Errors)](#error-handling-onparseerror--async-errors)
  - [Disconnecting](#disconnecting)
  - [Checking State](#checking-state)
- [HttpClient In-Depth](#httpclient-in-depth)
  - [Initialization](#initialization)
  - [Querying Topics (`query`)](#querying-topics-query)
  - [Batch Querying (`queryBatch`)](#batch-querying-querybatch)
  - [Querying as JSON (`queryJson`, `queryJsonBatch`)](#querying-as-json-queryjson-queryjsonbatch)
  - [Error Handling](#error-handling)
- [Error Types](#error-types)
- [Development](#development)
- [License](#license)

## Installation

```bash
npm install mqtt-topping
```

_(Requires Node.js version specified in `package.json` -> `engines.node`, >=22.0.0)_

## Quick Start

### MqttClient Example

```typescript
import { MqttClient, type MqttClientOptions } from "mqtt-topping"

const brokerUrl = "mqtt://test.mosquitto.org" // Use a public or your own broker
const options: MqttClientOptions = {
  clientId: `mqtt-topping-demo-${Math.random().toString(16).substring(2, 8)}`,
  // Add other MQTT.js options if needed (auth, etc.)
}

try {
  console.log(`Connecting to ${brokerUrl}...`)
  const client = await MqttClient.connect(brokerUrl, {
    ...options,
    // Handle payload parsing errors (invalid JSON, custom parser failures)
    onParseError: (error, topic, rawPayload) => {
      console.warn(`Failed to parse payload for topic ${topic}:`, error.message)
    },
  })
  console.log("Connected!")

  // Listen for background errors on the underlying mqtt.js client
  client.underlyingClient.on("error", (err) => {
    console.error("MQTT Background Error:", err)
  })

  const topic = "mqtt-topping/demo/sensor"

  // Subscribe (default parseType: 'json')
  await client.subscribe(
    topic,
    (payload, receivedTopic) => {
      console.log(`Received on ${receivedTopic}:`, payload)
    },
    { qos: 1 },
  )
  console.log(`Subscribed to ${topic}`)

  // Publish JSON data
  const dataToSend = { temp: 25.5, humidity: 60, ts: Date.now() }
  console.log(`Publishing to ${topic}:`, dataToSend)
  await client.publish(topic, dataToSend, { qos: 1, retain: false })

  // Wait a moment to receive the message
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Clean up
  console.log("Unpublishing (clearing retained)...")
  await client.unpublish(topic) // Clear potential retained message (though we didn't set retain=true)

  console.log("Disconnecting...")
  await client.disconnect()
  console.log("Disconnected.")
} catch (error) {
  console.error("MQTT Topping Error:", error)
}
```

## TypeScript Advanced Usage

This library provides excellent TypeScript support with automatic type inference based on your `parseType` selection. Here are some advanced patterns:

### Strongly Typed JSON Payloads

For even better type safety with JSON payloads, you can define interfaces and use type assertions:

```typescript
interface SensorReading {
  temperature: number
  humidity: number
  timestamp: number
  deviceId: string
}

// Subscribe with type assertion
await client.subscribe(
  "sensors/+/reading",
  (payload, topic, packet) => {
    // payload is 'unknown', but you can assert the type for JSON data
    const reading = payload as SensorReading
    console.log(`Device ${reading.deviceId}: ${reading.temperature}°C`)
  },
  { parseType: "json" },
)
```

### Multiple Parse Types in One Application

Different topics can use different parse types with full type safety:

```typescript
// JSON for structured data
await client.subscribe(
  "data/json",
  (payload, topic, packet) => {
    // payload: unknown (parsed JSON) - use type assertion
    console.log("JSON data:", (payload as { value: unknown }).value)
  },
  { parseType: "json" },
)

// String for simple text messages
await client.subscribe(
  "logs/info",
  (payload, topic, packet) => {
    // payload: string
    console.log("Log message:", payload.toUpperCase())
  },
  { parseType: "string" },
)

// Buffer for binary protocols
await client.subscribe(
  "binary/+",
  (payload, topic, packet) => {
    // payload: Buffer
    console.log("Binary length:", payload.length)
    const header = payload.readUInt32BE(0)
  },
  { parseType: "buffer" },
)
```

### Custom Parsers with Type Safety

When using custom parsers, you can define the return type:

```typescript
interface ProtobufMessage {
  id: number
  data: string
}

// Define a typed custom parser
const parseProtobuf = (buffer: Buffer): ProtobufMessage => {
  // Your protobuf parsing logic here
  return {
    id: buffer.readUInt32BE(0),
    data: buffer.toString("utf8", 4),
  }
}

await client.subscribe(
  "proto/messages",
  (payload, topic, packet) => {
    // payload: unknown, but you know it's ProtobufMessage from your parser
    const message = payload as ProtobufMessage
    console.log(`Message ${message.id}: ${message.data}`)
  },
  {
    parseType: "custom",
    customParser: parseProtobuf,
  },
)
```

### HttpClient Example

```typescript
import {
  HttpClient,
  type HttpQuery,
  type HttpClientOptions,
} from "mqtt-topping"

// Replace with the actual URL of your MQTT-HTTP bridge/API
const baseHttpUrl = "http://your-mqtt-http-endpoint.com"

// Basic usage
const httpClient = new HttpClient(baseHttpUrl)

// With custom configuration
const options: HttpClientOptions = {
  requestTimeoutMs: 10000, // 10 seconds (default: 30000ms)
}
const configuredHttpClient = new HttpClient(baseHttpUrl, options)

const targetTopic = "some/device/status"

try {
  // Query a single topic, parsing the payload as JSON (default)
  console.log(`Querying ${targetTopic}...`)
  const query: HttpQuery = { topic: targetTopic, depth: 1 } // Get immediate children
  const result = await httpClient.query(query)
  console.log("Query Result:", JSON.stringify(result, null, 2))

  // Query a specific topic and convert the result structure to a plain JS object
  console.log(`\nQuerying ${targetTopic} as JSON object...`)
  const jsonResult = await httpClient.queryJson(targetTopic)
  console.log("Query JSON Result:", jsonResult)
} catch (error) {
  console.error("HTTP Client Error:", error)
  // Check error type, e.g., HttpNetworkError, HttpRequestError, HttpServerError
}
```

## MqttClient In-Depth

### Connection

Connect to an MQTT broker using the static `connect` method:

```typescript
import { MqttClient, type MqttClientOptions } from "mqtt-topping"

const options: MqttClientOptions = {
  clientId: "my-app-1",
  username: "user", // If authentication needed
  password: "password",
  connectTimeout: 5000, // ms, default 30000
  keepalive: 60, // seconds, default 30
  // Other standard MQTT.js options...
  // Handle parse errors:
  onParseError: (error, topic, rawPayload) => {
    console.warn(`Parse error on ${topic}:`, error.message)
  },
}

try {
  const client = await MqttClient.connect("mqtt://your-broker.com", options)
  // ... use client
} catch (error) {
  // Handle MqttConnectionError, MqttUsageError
  console.error("Connection failed:", error)
}
```

### Subscribing

Subscribe to topics to receive messages.

```typescript
// Subscribe with default options (QoS 2, parseType 'json')
await client.subscribe("sensors/+/temperature", handleTemperature)

// Subscribe with specific options
await client.subscribe("devices/control", handleControlMessage, {
  qos: 1,
  parseType: "string", // Expect payload as a string
})

// Subscribe with a custom parser
const decodeProtobuf = (payload: Buffer): MyProtoMessage => {
  /* ... */
}
await client.subscribe("protobuf/data", handleProtoData, {
  parseType: "custom",
  customParser: decodeProtobuf,
})

// Multiple handlers for the same topic
await client.subscribe("alerts/#", handleAlertsGeneral)
await client.subscribe("alerts/critical", handleAlertsCritical) // Both called for 'alerts/critical'
```

- **`topic`**: The MQTT topic (wildcards `+` and `#` supported).
- **`callback`**: Function called on message arrival. The payload type is automatically inferred based on `parseType`:

```typescript
(payload: Buffer | string | unknown, topic: string, packet: Packet) => void
```

**Payload Types by `parseType`:**

- `parseType: "buffer"` → `payload: Buffer` - Raw binary data
- `parseType: "string"` → `payload: string` - UTF-8 decoded string
- `parseType: "json"` → `payload: unknown` - Parsed JSON object/value (any valid JSON)
- `parseType: "custom"` → `payload: unknown` - Result from your custom parser

**TypeScript Usage Examples:**

```typescript
// Buffer payload
await client.subscribe(
  "sensor/data",
  (payload, topic, packet) => {
    // payload is Buffer when parseType is 'buffer'
    console.log("Received buffer:", (payload as Buffer).length, "bytes")
  },
  { parseType: "buffer" },
)

// String payload
await client.subscribe(
  "sensor/status",
  (payload, topic, packet) => {
    // payload is string when parseType is 'string'
    console.log("Status:", (payload as string).toUpperCase())
  },
  { parseType: "string" },
)

// JSON payload (default)
await client.subscribe(
  "sensor/reading",
  (payload, topic, packet) => {
    // payload is unknown (parsed JSON) - use type assertion
    console.log(
      "Temperature:",
      (payload as { temperature: number }).temperature,
    )
  },
  { parseType: "json" },
)

// Custom parser (optional - if omitted, raw Buffer is passed to callback)
const decodeProtobuf = (buffer: Buffer) => ({ custom: "data" })
await client.subscribe(
  "sensor/proto",
  (payload, topic, packet) => {
    // payload is unknown (result from custom parser) - use type assertion
    console.log("Custom data:", (payload as { custom: string }).custom)
  },
  { parseType: "custom", customParser: decodeProtobuf },
)

// Custom parseType without parser (fallback to raw buffer)
await client.subscribe(
  "sensor/raw",
  (payload, topic, packet) => {
    // payload is the raw Buffer when customParser is omitted
    console.log("Raw bytes:", (payload as Buffer).length)
  },
  { parseType: "custom" }, // No customParser - gets raw Buffer
)
```

- **`opts`** (Optional):
  - `qos`: QoS level (0, 1, or 2). Default: 2.
  - `parseType`: 'json' (default), 'string', 'buffer', 'custom'.
  - `customParser`: Optional when `parseType` is 'custom'. `(payload: Buffer) => unknown`. If not provided, raw payload is passed to callback.
  - MQTT 5 properties can also be included here.

### Publishing

Publish messages to topics.

```typescript
// Publish JSON (default)
await client.publish("device/status", { online: true, timestamp: Date.now() })

// Publish with options (QoS 1, retain message, send as string)
await client.publish("device/config", JSON.stringify({ mode: "active" }), {
  qos: 1,
  retain: true,
  parseType: "string",
})

// Publish raw binary data
const binaryData = Buffer.from([0x01, 0x02, 0x03])
await client.publish("device/binary", binaryData, {
  qos: 0,
  parseType: "buffer",
})

// Publish with a custom serializer
const encodeMyData = (data: MyDataObject): Buffer => {
  /* ... */
}
await client.publish("custom/format", myDataObject, {
  parseType: "custom",
  customParser: encodeMyData,
})
```

- **`topic`**: The MQTT topic (wildcards **not** allowed).
- **`data`**: The payload to send. Type depends on `parseType`.
- **`opts`** (Optional):
  - `qos`: QoS level (0, 1, or 2). Default: 2.
  - `retain`: Boolean. Default: `true` unless topic matches `on[A-Z]*` or `do[A-Z]*` convention (e.g., `events/onUpdate`, `cmd/doAction`), then `false`. **Be mindful of this default heuristic.**
  - **Default Retain Heuristic:** The library assumes topics ending with `on` or `do` followed immediately by an uppercase letter represent events or commands and should _not_ be retained by default. For all
  - `parseType`: 'json' (default), 'string', 'buffer'. Note: 'custom' is not supported for publishing.
  - MQTT 5 properties can also be included here.

### Unsubscribing

Remove subscription handlers.

```typescript
// 1. Remove a specific handler function
await client.unsubscribe("sensors/+/temperature", handleTemperature)

// 2. Force remove ALL handlers for a topic and unsubscribe from broker
await client.forceUnsubscribe("alerts/#")
```

- **`unsubscribe(topic, callback, opts?)`**: Removes the specific `callback` for that `topic`. If it was the last handler, also unsubscribes from the broker.
- **`forceUnsubscribe(topic, opts?)`**: Removes all handlers associated with the `topic` pattern internally and unsubscribes from the broker.

### Clearing Retained Messages (`unpublish`)

Publish an empty message with the retain flag set to true (using QoS 2 by default) to clear a retained message on the broker for a specific topic.

```typescript
await client.unpublish("device/status") // Clear retained status
```

### Payload Parsing (`parseType`)

Controls how message payloads are handled during `subscribe` and `publish`. **With TypeScript, the callback payload type is automatically inferred based on your `parseType` choice:**

- **`'json'` (Default):**
  - Subscribe: Parses incoming Buffer payload as JSON → **`payload: unknown`** (parsed JSON object/value)
  - Publish: `JSON.stringify`s the provided data. Throws `MqttPayloadError` if stringify fails.
- **`'string'`:**
  - Subscribe: Converts incoming Buffer payload to UTF-8 string → **`payload: string`**
  - Publish: Converts provided data to string using `String()`.
- **`'buffer'`:**
  - Subscribe: Passes the raw Buffer payload to the callback → **`payload: Buffer`**
  - Publish: Expects data to be a `Buffer`. If not, attempts `Buffer.from(String(data))`. Throws `MqttPayloadError` on failure.
- **`'custom'`:**
  - Subscribe: Optional `customParser: (payload: Buffer) => unknown`. If provided, calls the parser → **`payload: unknown`** (result from your custom parser). If not provided, passes raw payload.
  - Publish: **Not supported** - custom parseType is only available for subscribing.

**TypeScript Type Safety Example:**

```typescript
// Automatic type inference based on parseType
await client.subscribe(
  "data/json",
  (payload, topic, packet) => {
    // payload is typed as 'unknown' (parsed JSON) - use type assertion
    const data = payload as { temperature: number }
    console.log("Temperature:", data.temperature) // ✅ Type-safe with assertion
  },
  { parseType: "json" },
)

await client.subscribe(
  "data/string",
  (payload, topic, packet) => {
    // payload is typed as 'string' - can use string methods directly
    console.log("Length:", (payload as string).length) // ✅ String methods available
  },
  { parseType: "string" },
)

await client.subscribe(
  "data/binary",
  (payload, topic, packet) => {
    // payload is typed as 'Buffer' - can use Buffer methods directly
    console.log("Bytes:", (payload as Buffer).readUInt32BE(0)) // ✅ Buffer methods available
  },
  { parseType: "buffer" },
)
```

### Error Handling (`onParseError` & Async Errors)

- **Parse Errors:** Pass an `onParseError` callback in the connection options to handle incoming message parsing failures (invalid JSON, custom parser errors):
  ```typescript
  const client = await MqttClient.connect("mqtt://broker", {
    onParseError: (error, topic, rawPayload) => {
      console.warn(`Parse error on ${topic}:`, error.message)
    },
  })
  ```
  If no `onParseError` is provided, parse errors are silently ignored (the subscription callback is simply not called).
- **Connection/Operation Errors:** `connect`, `subscribe`, `publish`, etc., return Promises that reject with specific error types (e.g., `MqttConnectionError`, `MqttSubscribeError`, `MqttPublishError`, `MqttUsageError`, `InvalidTopicError`). Use `try...catch` with async/await.
- **Background Client Errors:** The library attaches a default no-op `"error"` listener to the underlying mqtt.js client to prevent unhandled errors from crashing your process. For custom error handling and lifecycle events, use `client.underlyingClient` directly:

```typescript
client.underlyingClient.on("error", (err) => {
  console.error("MQTT Client Error:", err)
})
client.underlyingClient.on("close", () => console.log("Connection closed."))
client.underlyingClient.on("reconnect", () => console.log("Reconnecting..."))
client.underlyingClient.on("offline", () => console.log("Client offline."))
```

### Disconnecting

Gracefully disconnect from the broker. Attempts to unsubscribe from all active subscriptions first.

```typescript
await client.disconnect() // Graceful disconnect
// await client.disconnect(true) // Force close socket immediately
```

### Checking State

```typescript
if (client.isConnected()) {
  // ...
}

if (client.isReconnecting()) {
  // Client is attempting to reconnect
}
```

## HttpClient In-Depth

Used to query MQTT data exposed over a compatible HTTP/JSON API.

### Initialization

```typescript
import { HttpClient, type HttpClientOptions } from "mqtt-topping"

// Basic initialization
const httpClient = new HttpClient("http://your-mqtt-http-endpoint.com")

// With configuration options
const options: HttpClientOptions = {
  requestTimeoutMs: 10000, // Custom timeout in ms (default: 30000)
}
const configuredHttpClient = new HttpClient(
  "http://your-mqtt-http-endpoint.com",
  options,
)
```

**Configuration Options:**

- **`requestTimeoutMs`** (Optional): HTTP request timeout in milliseconds. Default: `30000` (30 seconds).

### Querying Topics (`query`)

Retrieve data for a topic, potentially including children.

```typescript
import type { HttpQuery, HttpQueryResult } from "mqtt-topping"

const queryOptions: HttpQuery = {
  topic: "home/livingroom",
  depth: 2, // Get topic, children, and grandchildren
  flatten: false, // Keep hierarchical structure in response (default)
  parseJson: true, // Attempt to parse payloads as JSON (default)
}

try {
  const result: HttpQueryResult = await httpClient.query(queryOptions)
  // result might be TopicResult or FlatTopicResult[] based on API response
  console.log(result)
} catch (error) {
  console.error("HTTP Query Error:", error)
}
```

- **`query`**: An object with:
  - `topic`: The target topic. Wildcards usually **not** supported by backend APIs.
  - `depth` (Optional): How many levels of children to retrieve (-1 for all, 0 for topic only, 1 for topic + direct children, etc.). Default depends on the backend API.
  - `flatten` (Optional): If `true`, returns a flat array (`FlatTopicResult[]`) instead of a nested structure (`TopicResult`). Default: `false`.
  - `parseJson` (Optional): If `true` (default), attempts to `JSON.parse` string/buffer payloads in the response. If `false`, leaves payloads as they are received (likely strings).

### Batch Querying (`queryBatch`)

Retrieve data for multiple topics in a single HTTP request.

```typescript
import type { HttpQuery, HttpBatchQueryResult } from "mqtt-topping"

const queries: HttpQuery[] = [
  { topic: "home/livingroom/temp", parseJson: true },
  { topic: "home/kitchen/light", parseJson: false }, // Get raw payload
  { topic: "alerts", depth: 0 },
]

try {
  const results: HttpBatchQueryResult = await httpClient.queryBatch(queries)
  // results is an array containing TopicResult | FlatTopicResult[] | Error
  results.forEach((res, index) => {
    if (res instanceof Error) {
      console.error(`Query for "${queries[index].topic}" failed:`, res)
    } else {
      console.log(`Result for "${queries[index].topic}":`, res)
    }
  })
} catch (error) {
  console.error("HTTP Batch Query Error:", error)
}
```

### Querying as JSON (`queryJson`, `queryJsonBatch`)

Convenience methods specifically for retrieving data from non-wildcard topics and converting the hierarchical result into a single JavaScript object/value.

```typescript
try {
  // Get data under 'home/livingroom' as a nested JS object
  const livingRoomData: unknown = await httpClient.queryJson("home/livingroom")
  console.log(livingRoomData) // e.g., { temp: { value: 22 }, light: { state: 'on' } }

  // Get multiple topics as objects/values
  const batchJsonResults = await httpClient.queryJsonBatch([
    "home/livingroom/temp/value",
    "home/kitchen/light/state",
  ])
  // batchJsonResults is Array<unknown | HttpError>
  console.log(batchJsonResults) // e.g., [ 22, 'on' ]
} catch (error) {
  console.error("HTTP JSON Query Error:", error)
}
```

**Note:** `queryJson` and `queryJsonBatch` **do not support wildcards** (`+`, `#`) in topics, as they are designed to fetch and structure data from a specific base topic path. They throw an `HttpQueryError` if wildcards are used.

### Error Handling

The `HttpClient` methods return Promises that reject on failure. Catch errors and check their type:

- `HttpNetworkError`: Problem reaching the server (DNS, connection refused).
- `HttpTimeoutError`: Request timed out.
- `HttpRequestError`: Server responded with non-2xx status (e.g., 404, 500). Contains `statusCode` and potentially `responseBody`.
- `HttpPayloadParseError`: Failed to parse the HTTP response body (or a payload within it if `parseJson` was true).
- `HttpServerError`: The batch query response indicated a server-side error for a specific topic. Contains `topic` and `serverError` details.
- `HttpQueryError`: Invalid query parameter (e.g., wildcard in `queryJson`).
- `HttpProcessingError`: Internal error during response processing (e.g., structuring JSON object).

## Error Types

The library exports custom error classes extending the base `MqttToppingError`:

- `MqttError` (Base for MQTT issues)
  - `MqttConnectionError`
  - `MqttSubscribeError`
  - `MqttUnsubscribeError`
  - `MqttPublishError`
  - `MqttPayloadError`
  - `MqttUsageError`
  - `MqttDisconnectError`
  - `InvalidTopicError`
- `HttpError` (Base for HTTP client issues)
  - `HttpNetworkError`
  - `HttpTimeoutError`
  - `HttpRequestError`
  - `HttpQueryError`
  - `HttpPayloadParseError`
  - `HttpServerError`
  - `HttpProcessingError`

Use `instanceof` to check error types in your `catch` blocks.

## Development

1. **Clone:** `git clone https://github.com/artcom/mqtt-topping.git`
2. **Install:** `cd mqtt-topping && npm install`
3. **Build:** `npm run build` (Cleans `dist` and runs `tsc`)
4. **Watch:** `npm run watch` (Runs `tsc` in watch mode)
5. **Test:** `npm test` (Runs Jest tests)
6. **Lint:** `npm run lint` (Checks code style with ESLint)
7. **Format:** `npm run format` (Formats code with Prettier)

Contributions are welcome! Please follow standard fork/pull request workflow and ensure tests and linting pass.

## License

[MIT](./LICENSE) &copy; ART+COM GmbH
