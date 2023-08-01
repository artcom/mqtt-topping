import { AsyncClient, Packet, ISubscriptionGrant, QoS, IUnsubackPacket } from "async-mqtt"

import { isEventOrCommand, isValidTopic, matchTopic } from "./helpers"
import {
  MessageCallback,
  SubscribeOptions,
  Subscriptions,
  PublishOptions,
  SubscriptionHandler,
  ErrorCallback,
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

  disconnect(force: boolean): Promise<void> {
    return this.client.end(force)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  publish(topic: string, payload: any, publishOptions: PublishOptions = {}): Promise<void> {
    const {
      qos = 2,
      stringifyJson = true,
      retain = !isEventOrCommand(topic),
      ...options
    } = publishOptions

    if (!isValidTopic(topic)) {
      throw new Error(`Invalid topic: ${topic}`)
    }

    if (stringifyJson) {
      payload = JSON.stringify(payload) // eslint-disable-line no-param-reassign
    }

    return this.client.publish(topic, payload, { retain, qos, ...options })
  }

  unpublish(topic: string, qos: QoS = 2): Promise<void> {
    return this.publish(topic, "", { qos, retain: true, stringifyJson: false })
  }

  subscribe(
    topic: string,
    callback: MessageCallback,
    subscribeOptions: SubscribeOptions = { qos: 2 }
  ): Promise<ISubscriptionGrant[]> {
    const { qos = 2, parseJson = true, ...options } = subscribeOptions

    if (!this.subscriptions[topic]) {
      this.subscriptions[topic] = { matchTopic: matchTopic(topic), handlers: [] }
    }

    this.subscriptions[topic].handlers.push({ callback, qos, parseJson })

    return this.client.subscribe(topic, { qos, ...options })
  }

  unsubscribe(topic: string, callback: MessageCallback): Promise<IUnsubackPacket> | Promise<void> {
    const subscription = this.subscriptions[topic]
    if (subscription) {
      subscription.handlers = subscription.handlers.filter(
        (handler) => handler.callback !== callback
      )

      if (subscription.handlers.length === 0) {
        delete this.subscriptions[topic]
        return this.client.unsubscribe(topic)
      }
    }

    return Promise.resolve()
  }

  forceUnsubscribe(topic: string): Promise<IUnsubackPacket> | Promise<void> {
    const subscription = this.subscriptions[topic]
    if (subscription) {
      delete this.subscriptions[topic]
      return this.client.unsubscribe(topic)
    }

    return Promise.resolve()
  }

  handleMessage(topic: string, payload: Buffer, packet: Packet): void {
    const [success, json] = parsePayload(payload)
    let logParseError = false

    const matchingHandlers = Object.keys(this.subscriptions).reduce<SubscriptionHandler[]>(
      (handlers, key) => {
        const subscription = this.subscriptions[key]
        return subscription.matchTopic(topic) ? [...handlers, ...subscription.handlers] : handlers
      },
      []
    )

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
