import * as mqtt from "mqtt"

import MqttClient from "./mqtt/mqttClient"
import { ClientOptions } from "./mqtt/types"

export { default as HttpClient } from "./http/httpClient"
export { unpublishRecursively } from "./utils"

const KEEP_ALIVE = 30
const CONNECT_TIMEOUT = 3000

export function connect(uri: string, options: ClientOptions = {}): MqttClient {
  const { onParseError, clientOptions } = processOptions(options)
  const client = mqtt.connect(uri, clientOptions)
  return new MqttClient(client, onParseError)
}

export async function connectAsync(uri: string, options: ClientOptions = {}): Promise<MqttClient> {
  const { onParseError, clientOptions } = processOptions(options)
  const client = await mqtt.connectAsync(uri, clientOptions)
  return new MqttClient(client, onParseError)
}

export { default as MqttClient } from "./mqtt/mqttClient"

export * as mqttjs from "mqtt"

export {
  MessageCallback,
  SubscribeOptions,
  Subscriptions,
  PublishOptions,
  SubscriptionHandler,
  ErrorCallback,
} from "./mqtt/types"

function processOptions(options: ClientOptions) {
  const { onParseError, appId, deviceId, clientId, will, ...rest } = options

  const clientOptions: ClientOptions = {
    clientId: clientId || createClientId(appId, deviceId),
    keepalive: KEEP_ALIVE,
    connectTimeout: CONNECT_TIMEOUT,
    will:
      will && will.stringifyJson !== false
        ? { ...will, payload: Buffer.from(JSON.stringify(will.payload)) }
        : will,
    ...rest,
  }

  return { onParseError, clientOptions }
}

function createClientId(appId = "UnknownApp", deviceId?: string) {
  const uuid = Math.random().toString(16).substr(2, 8)
  return deviceId ? `${appId}-${deviceId}-${uuid}` : `${appId}-${uuid}`
}
