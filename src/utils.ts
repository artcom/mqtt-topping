import { FlatTopicResult } from "./http/types"
import { default as MqttClient } from "./mqtt/mqttClient"
import { default as HttpClient } from "./http/httpClient"

export async function unpublishRecursively(
  mqttClient: MqttClient,
  httpClient: HttpClient,
  topic: string,
): Promise<void[]> {
  const query = { topic, depth: -1, flatten: true, parseJson: false }
  const subTopics = (await httpClient.query(query)) as FlatTopicResult[]

  const promises = subTopics
    .filter((subTopic) => subTopic.payload !== undefined)
    .map((subTopic) => mqttClient.unpublish(subTopic.topic))

  return Promise.all(promises)
}
