import { connectAsync, IPublishPacket } from "async-mqtt"

import HttpClient from "./httpClient"
import MqttClient from "./mqttClient"
import { ClientOptions, FlatTopicResult } from "./types"

export { default as MqttClient } from "./mqttClient"
export { default as HttpClient } from "./httpClient"

export async function connect(uri: string, options?: ClientOptions) {
  const client = await connectAsync(uri, options, false)
  return new MqttClient(client, options?.onParseError)
}

export async function unpublishRecursively(
  mqttClient: MqttClient, httpClient: HttpClient, topic: string
) {
  const result = await httpClient.query({ topic, depth: -1, flatten: true, parseJson: false })
  const subTopics = result as FlatTopicResult[]
  const unpublishPromises = subTopics.reduce<Promise<IPublishPacket>[]>(
    (promises, subTopic) =>
      subTopic.payload ? [...promises, mqttClient.unpublish(subTopic.topic)] : promises,
    [])

  return Promise.all(unpublishPromises)
}
