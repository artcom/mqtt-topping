import {
  AsyncClient,
  Packet,
  IPublishPacket,
  ISubscriptionGrant,
  QoS,
  IUnsubackPacket
} from "async-mqtt"

import { isEventOrCommand, matchTopic } from "./helpers"
import {
  MessageCallback,
  SubscribeOptions,
  Subscriptions,
  PublishOptions,
  SubscriptionHandler,
  ErrorCallback
} from "./types"

export default class MqttClient {
  client: AsyncClient
  on: AsyncClient["on"]
  once: AsyncClient["once"]

  private onParseError?: ErrorCallback
  private subscriptions: Subscriptions

  constructor(client: AsyncClient, onParseError?: ErrorCallback) {
    this.client = client
    this.onParseError = onParseError

    this.subscriptions = {}
    this.on = this.client.on.bind(this.client)
    this.once = this.client.once.bind(this.client)
    this.client.on("message", this.handleMessage.bind(this))
  }

  disconnect() {
    return this.client.end()
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  publish(topic: string, payload: any, options: PublishOptions = {}): Promise<IPublishPacket> {
    const { qos = 2, stringifyJson = true, retain = !isEventOrCommand(topic) } = options

    if (stringifyJson) {
      payload = JSON.stringify(payload) // eslint-disable-line no-param-reassign
    }

    return this.client.publish(topic, payload, { retain, qos })
  }

  unpublish(topic: string, qos: QoS = 2): Promise<IPublishPacket> {
    return this.publish(topic, "", { qos, retain: true, stringifyJson: false })
  }

  subscribe(
    topic: string,
    callback: MessageCallback,
    options: SubscribeOptions = {}
  ): Promise<ISubscriptionGrant[]> {
    const { qos = 2, parseJson = true } = options

    if (!this.subscriptions[topic]) {
      this.subscriptions[topic] = { matchTopic: matchTopic(topic), handlers: [] }
    }

    this.subscriptions[topic].handlers.push({ callback, qos, parseJson })

    return this.client.subscribe(topic, { qos })
  }

  unsubscribe(topic: string, callback: MessageCallback): Promise<IUnsubackPacket> | Promise<void> {
    const subscription = this.subscriptions[topic]

    if (subscription) {
      subscription.handlers = subscription.handlers.filter(handler => handler.callback !== callback)
    }

    if (subscription.handlers.length === 0) {
      delete this.subscriptions[topic]
      return this.client.unsubscribe(topic)
    } else {
      return Promise.resolve()
    }
  }

  handleMessage(topic: string, payload: Buffer, packet: Packet): void {
    const [success, json] = parsePayload(payload)
    let logParseError = false

    const matchingHandlers = Object.keys(this.subscriptions)
      .reduce<SubscriptionHandler[]>((handlers, key) => {
        const subscription = this.subscriptions[key]
        return subscription.matchTopic(topic) ? [...handlers, ...subscription.handlers] : handlers
      }, [])

    matchingHandlers.forEach(({ callback, parseJson }) => {
      if (parseJson) {
        if (success) {
          callback(json, topic, packet)
        } else {
          logParseError = true
        }
      } else {
        callback(payload.toString(), topic, packet)
      }
    })

    if (logParseError && this.onParseError) {
      this.onParseError(payload, topic)
    }
  }
}

function parsePayload(payload: Buffer): [boolean, any] {
  try {
    return [true, JSON.parse(payload.toString())]
  } catch (error) {
    return [payload.length === 0, undefined]
  }
}
