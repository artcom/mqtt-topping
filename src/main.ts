import { connectAsync } from "async-mqtt"

import MqttClient from "./mqtt/mqttClient"
import { ClientOptions } from "./mqtt/types"

export { default as HttpClient } from "./http/httpClient"
export { unpublishRecursively } from "./utils"

export async function connectMqttClient(uri: string, options?: ClientOptions) {
  const client = await connectAsync(uri, options, false)
  return new MqttClient(client, options?.onParseError)
}

