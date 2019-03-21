import * as Mqtt from "mqtt"

export type MessageCallback = (json: any, topic: string, packet: Mqtt.Packet) => void

export interface ISubscribeOptions {
  parseJson: boolean
}

export interface IPublishOptions {
  qos: 0 | 1 | 2,
  stringifyJson: boolean
}

export class ClientWrapper {
  disconnect: () => void
  query: (query: string) => Promise<any>
  queryJson: (query: string) => Promise<any>
  publish: (topic: string, payload: any, options?: IPublishOptions) => Promise<any>
  unpublish: (topic: string) => Promise<any>
  unpublishRecursively: (topic: string) => Promise<any>
  subscribe: (topic: string, callback: MessageCallback, options?: ISubscribeOptions) => Promise<any>
  unsubscribe: (topic: string, callback: MessageCallback) => Promise<any>
  
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
}

export interface MqttToppingStatic {
  connect: (tcpUri: string, httpUri: string, options?: Mqtt.IClientOptions) => ClientWrapper
}

declare const MqttTopping: MqttToppingStatic

export default MqttTopping
