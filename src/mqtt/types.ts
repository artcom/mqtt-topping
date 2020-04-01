import { IClientOptions, Packet, QoS } from "async-mqtt"

export type ErrorCallback = (payload: Buffer, topic: string) => void
export interface ClientOptions extends IClientOptions { onParseError?: ErrorCallback }

export type PublishOptions = { qos?: QoS; stringifyJson?: boolean; retain?: boolean }
export type UnpublishOptions = { qos?: QoS; retain?: boolean }
export type SubscribeOptions = { qos?: QoS; parseJson?: boolean }

export type MessageCallback = (payload: any, topic: string, packet: Packet) => void
export type TopicMatcher = (topic: string) => boolean
export type SubscriptionHandler = { callback: MessageCallback; qos: QoS; parseJson: boolean }
export type Subscription = { matchTopic: TopicMatcher; handlers: SubscriptionHandler[] }
export type Subscriptions = { [topic: string]: Subscription }
