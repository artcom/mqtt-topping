import { Packet, IClientOptions, IClientSubscribeProperties } from "mqtt"

import type { QoS } from "mqtt-packet"
export type PayloadParseType = "json" | "string" | "buffer" | "custom"

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

export interface PublishOptions {
  qos?: QoS
  retain?: boolean
  parseType?: PublishPayloadParseType
  customParser?: (payload: unknown) => string | Buffer
  properties?: Record<string, unknown>
}
