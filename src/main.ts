import { connectAsync } from "async-mqtt"

import MqttClient from "./mqtt/mqttClient"
import { ClientOptions } from "./mqtt/types"

export { default as HttpClient } from "./http/httpClient"
export { unpublishRecursively } from "./utils"

export async function connectMqttClient(uri: string, options: ClientOptions = {}) {
  const { onParseError, ...rest } = options
  const clientOptions = {
    keepalive: 3,
    connectTimeout: 3000,
    ...rest
  }

  const client = await connectAsync(uri, clientOptions, false)
  return new MqttClient(client, onParseError)
}

// export types
export { default as MqttClient } from "./mqtt/mqttClient"

export * as mqttjs from "async-mqtt"
export {
  MessageCallback,
  SubscribeOptions,
  Subscriptions,
  PublishOptions,
  SubscriptionHandler,
  ErrorCallback
} from "./mqtt/types"
