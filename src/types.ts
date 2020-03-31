import { Packet, QoS, IClientOptions } from "async-mqtt"

export type ErrorCallback = (payload: Buffer, topic: string) => void

export interface ClientOptions extends IClientOptions {
    onParseError?: ErrorCallback;
}

export type Query = {
    topic: string;
    depth?: number;
    flatten?: boolean;
    parseJson?: boolean;
}

export type TopicResult = {
    topic: string;
    payload?: any;
    children?: Array<TopicResult>;
}

export type FlatTopicResult = {
    topic: string;
    payload?: any;
}

export type QueryResult = TopicResult | FlatTopicResult[]

export type JsonResult = {[key: string]: any}

export type MessageCallback = (payload: any, topic: string, packet: Packet) => void

export type TopicMatcher = (topic: string) => boolean

export type SubscriptionHandler = { callback: MessageCallback; qos: QoS; parseJson: boolean }

export type Subscription = {
    matchTopic: TopicMatcher;
    handlers: SubscriptionHandler[];
}

export type Subscriptions = { [topic: string]: Subscription }

export type PublishOptions = { qos?: QoS; stringifyJson?: boolean }
export type SubscribeOptions = { qos?: QoS; parseJson?: boolean }
