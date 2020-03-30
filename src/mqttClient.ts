import { AsyncClient, IPublishPacket, Packet } from "async-mqtt"
import { isEventOrCommand, matchTopic } from "./helpers"
import {
  MessageCallback,
  SubscribeOptions,
  Subscriptions,
  PublishOptions,
  SubscriptionHandler
} from "./types"

export default class MqttClient {
  client: AsyncClient
  subscriptions: Subscriptions

  constructor(client: AsyncClient) {
    this.client = client

    this.subscriptions = {}
    this.client.on("message", this.handleMessage.bind(this))
  }

  disconnect(): Promise<void> {
    return this.client.end()
  }

  publish(topic: string, payload: any, options: PublishOptions = {}): Promise<IPublishPacket> {
    const { qos = 2, stringifyJson = true } = options

    if (stringifyJson) {
      payload = JSON.stringify(payload) // eslint-disable-line no-param-reassign
    }

    return this.client.publish(topic, payload, { retain: !isEventOrCommand(topic), qos })
  }

  unpublish(topic: string): Promise<IPublishPacket> {
    return this.client.publish(topic, "", { retain: true, qos: 2 })
  }

  subscribe(topic: string, callback: MessageCallback, options: SubscribeOptions = {}) {
    const { qos = 2, parseJson = true } = options

    if (!this.subscriptions[topic]) {
      this.subscriptions[topic] = { matchTopic: matchTopic(topic), handlers: [] }
    }

    this.subscriptions[topic].handlers.push({ callback, qos, parseJson })

    return this.client.subscribe(topic, { qos })
  }

  unsubscribe(topic: string, callback: MessageCallback) {
    const subscription = this.subscriptions[topic]

    if (subscription) {
      subscription.handlers = subscription.handlers.filter(handler => handler.callback !== callback)
    }

    if (subscription.handlers.length === 0) {
      delete this.subscriptions[topic]
      return this.client.unsubscribe(topic)
    }
  }

  handleMessage(topic: string, payload: Buffer, packet: Packet) {
    const [success, json] = parsePayload(payload)
    let showError = false

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
          showError = true
        }
      } else {
        callback(payload.toString(), topic, packet)
      }
    })

    if (showError) {
      console.log(`Ignoring MQTT message for topic '${topic}': invalid JSON payload '${payload}'`)
    }
  }
}

function parsePayload(payload: Buffer) {
  try {
    return [true, JSON.parse(payload.toString())]
  } catch (error) {
    return [payload.length === 0, undefined]
  }
}
