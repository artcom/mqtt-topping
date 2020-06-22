import { IPublishPacket } from "async-mqtt"
import { FlatTopicResult } from "./http/types"
import { default as MqttClient } from "./mqtt/mqttClient"
import { default as HttpClient } from "./http/httpClient"

export async function unpublishRecursively(
  mqttClient: MqttClient, httpClient: HttpClient, topic: string
) : Promise<IPublishPacket[]> {
  const result = await httpClient.query({ topic, depth: -1, flatten: true, parseJson: false })
  const subTopics = result as FlatTopicResult[]
  const unpublishPromises = subTopics.reduce<Promise<IPublishPacket>[]>(
    (promises, subTopic) =>
      subTopic.payload ? [...promises, mqttClient.unpublish(subTopic.topic)] : promises,
    [])

  return Promise.all(unpublishPromises)
}
