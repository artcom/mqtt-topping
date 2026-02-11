import {
  Packet,
  IClientOptions,
  IClientSubscribeProperties,
  IClientUnsubscribeProperties,
} from "mqtt"

import type { QoS } from "mqtt-packet"
export type PayloadParseType = "json" | "string" | "buffer" | "custom"

// Type mapping for payload based on parseType
export type PayloadType<T extends PayloadParseType> = T extends "buffer"
  ? Buffer
  : T extends "string"
    ? string
    : T extends "json"
      ? unknown // JSON can be any valid JSON value
      : T extends "custom"
        ? unknown // Custom parser can return anything
        : unknown

export type PublishPayloadParseType = Exclude<PayloadParseType, "custom">

export type MqttResult = {
  packet: Packet
}

export type ParseErrorCallback = (
  error: Error,
  topic: string,
  rawPayload: Buffer | Uint8Array,
) => void

export interface ClientOptions extends IClientOptions {
  appId?: string
  deviceId?: string
  onParseError?: ParseErrorCallback
  will?: IClientOptions["will"] & {
    stringifyJson: boolean
    payload: unknown // Let MQTT.js handle the type
  }
}

export type MessageCallback = (
  payload: Buffer | string | unknown,
  topic: string,
  packet: Packet,
) => void

export interface SubscriptionHandler {
  callback: MessageCallback
  qos: QoS
  parseType?: PayloadParseType
  customParser?: (payload: unknown) => unknown
}

export interface SubscribeOptions extends IClientSubscribeProperties {
  qos?: QoS
  parseType?: PayloadParseType
  customParser?: (payload: unknown) => unknown
}

export interface PublishOptions extends IClientUnsubscribeProperties {
  qos?: QoS
  retain?: boolean
  parseType?: PublishPayloadParseType
  customParser?: (payload: unknown) => string | Buffer
}
