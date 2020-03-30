import { connectAsync, IPublishPacket } from "async-mqtt"

import HttpClient from "./httpClient"
import MqttClient from "./mqttClient"
import { ClientOptions, FlatTopicResult } from "./types"

export async function connect(mqttUri: string, httpUri?: string, options?: ClientOptions) {
  const mqttApi = await createMqttApi(mqttUri, options)
  const httpApi = httpUri ? createHttpApi(httpUri, mqttApi.unpublish) : {}

  return { ...mqttApi, ...httpApi }
}

async function createMqttApi(uri: string, options?: ClientOptions) {
  const client = await connectAsync(uri, options, false)
  const mqttClient = new MqttClient(client, options?.onParseError)

  return {
    publish: mqttClient.publish.bind(mqttClient),
    unpublish: mqttClient.unpublish.bind(mqttClient),
    subscribe: mqttClient.subscribe.bind(mqttClient),
    unsubscribe: mqttClient.unsubscribe.bind(mqttClient),
    disconnect: mqttClient.disconnect.bind(mqttClient),

    client: mqttClient.client,

    on: mqttClient.client.on.bind(mqttClient.client),
    once: mqttClient.client.once.bind(mqttClient.client)
  }
}

function createHttpApi(uri: string, unpublish: (topic: string) => any) {
  const httpClient = new HttpClient(uri)
  return {
    queryJson: httpClient.queryJson.bind(httpClient),
    queryJsonBatch: httpClient.queryJsonBatch.bind(httpClient),
    queryBatch: httpClient.queryBatch.bind(httpClient),
    query: httpClient.query.bind(httpClient),

    unpublishRecursively:
      (topic: string) => httpClient.query({ topic, depth: -1, flatten: true, parseJson: false })
        .then(result => {
          const subTopics = result as FlatTopicResult
          const unpublishPromises = subTopics.reduce<Promise<IPublishPacket>[]>(
            (promises, subTopic) =>
              subTopic.payload ? [...promises, unpublish(subTopic.topic)] : promises,
            [])

          return Promise.all(unpublishPromises)
        })
  }
}
