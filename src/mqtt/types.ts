import {
  IClientOptions,
  IClientPublishOptions,
  IClientSubscribeOptions,
  Packet,
  QoS
} from "async-mqtt"

export type ErrorCallback = (payload: Buffer, topic: string) => void

export interface ClientOptions extends IClientOptions {
    appId?: string,
    deviceId?: string,
    will?: IClientOptions["will"] & { stringifyJson: boolean; payload: any; },
    onParseError?: ErrorCallback
}

export interface PublishOptions extends IClientPublishOptions {
    stringifyJson?: boolean
}

export interface SubscribeOptions extends IClientSubscribeOptions {
    parseJson?: boolean
}

export type MessageCallback = (payload: any, topic: string, packet: Packet) => void
export type TopicMatcher = (topic: string) => boolean
export type SubscriptionHandler = { callback: MessageCallback; qos: QoS; parseJson: boolean }
export type Subscription = { matchTopic: TopicMatcher; handlers: SubscriptionHandler[] }
export type Subscriptions = { [topic: string]: Subscription }
