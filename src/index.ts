export { MqttClient } from "./mqtt/mqttClient"
export { HttpClient } from "./http/httpClient"

export type {
  SubscriptionHandler,
  MessageCallback,
  ClientOptions as MqttClientOptions,
  SubscribeOptions as MqttSubscribeOptions,
  PublishOptions as MqttPublishOptions,
  PayloadParseType as MqttPayloadParseType,
  PayloadType as MqttPayloadType,
  MqttResult,
} from "./mqtt/types"

export type { QoS } from "mqtt-packet"

export type {
  Query as HttpQuery,
  QueryResult as HttpQueryResult,
  BatchQueryResult as HttpBatchQueryResult,
  JsonResult as HttpJsonResult,
  TopicResult as HttpTopicResult,
  FlatTopicResult as HttpFlatTopicResult,
  BatchQueryResponse as HttpBatchQueryResponse,
  ErrorResult as HttpErrorResult,
  HttpClientOptions,
} from "./http/types"

export * from "./errors"
