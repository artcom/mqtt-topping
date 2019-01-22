import { MqttClient, Packet, connect, IClientOptions, QoS } from "mqtt"

import QueryWrapper, { query, result } from "./queryWrapper"
import { isEventOrCommand, matchTopic, shouldParseJson } from "./helpers"


type publishOps = { qos?: QoS, stringifyJson?: boolean }
type handler = { callback: () => {}, options: any }
type subscription = { matchTopic: (topic: any) => boolean, handlers: handler[] }

export default class ClientWrapper {
  client: MqttClient
  subscriptions: Map<string, subscription>
  addListener: MqttClient
  removeListener: MqttClient
  on: MqttClient
  once: MqttClient
  queryWrapper: QueryWrapper
  isConnected: boolean

  constructor(tcpUri: string, httpUri: string, options: IClientOptions) {
    this.client = connect(tcpUri, options)
    this.subscriptions = new Map()

    this.client.on("connect", this.handleConnect.bind(this))
    this.client.on("close", this.handleClose.bind(this))
    this.client.on("message", this.handleMessage.bind(this))

    this.addListener = this.client.addListener.bind(this.client)
    this.removeListener = this.client.removeListener.bind(this.client)
    this.on = this.client.on.bind(this.client)
    this.once = this.client.once.bind(this.client)

    this.queryWrapper = new QueryWrapper(httpUri)
  }

  disconnect() {
    return new Promise(resolve => {
      this.client.end(false, resolve)
    })
  }

  query(query: query) {
    return this.queryWrapper.send(query)
  }

  queryJson(query: query) {
    return this.queryWrapper.sendJson(query)
  }

  publish(topic: string, payload: any, { qos = 2, stringifyJson = true }: publishOps = {}) {
    if (stringifyJson) {
      payload = JSON.stringify(payload)
    }

    return new Promise(resolve => {
      const retain = !isEventOrCommand(topic)
      this.client.publish(topic, payload, { retain, qos }, resolve)
    })
  }

  unpublish(topic: string) {
    return new Promise(resolve => {
      this.client.publish(topic, null, { retain: true, qos: 2 }, resolve)
    })
  }

  unpublishRecursively(topic: string) {
    return this.query({
      topic,
      depth: -1,
      flatten: true,
      parseJson: false
    }).then(subtopics => {
      const unpublishPromises = subtopics.reduce((promises: Promise<{}>[], subtopic: result) => {
        if (subtopic.payload) {
          promises.push(this.unpublish(subtopic.topic))
        }

        return promises
      }, [])

      return Promise.all(unpublishPromises)
    })
  }

  subscribe(topic: string, options: any, callback: () => {}) {
    if (!callback) {
      callback = options
      options = {}
    }

    return new Promise(resolve => {
      let subscribe = false

      if (!this.subscriptions.has(topic)) {
        subscribe = true
        this.subscriptions.set(topic, {
          matchTopic: matchTopic(topic),
          handlers: []
        })
      }

      this.subscriptions.get(topic).handlers.push({ callback, options })

      if (subscribe && this.isConnected) {
        this.client.subscribe(topic, { qos: 2 }, resolve)
      } else {
        resolve()
      }
    })
  }

  unsubscribe(topic: string, callback: () => {}) {
    return new Promise(resolve => {
      const subscription = this.subscriptions.get(topic)

      if (subscription) {
        subscription.handlers = subscription.handlers.filter(handler =>
          handler.callback !== callback
        )

        if (subscription.handlers.length === 0) {
          this.client.unsubscribe(topic, resolve)
          this.subscriptions.delete(topic)
        } else {
          resolve()
        }
      }
    })
  }

  handleConnect() {
    this.isConnected = true

    Object.keys(this.subscriptions).forEach(topic => {
      this.client.subscribe(topic, { qos: 2 })
    })
  }

  handleClose() {
    this.isConnected = false
  }

  handleMessage(topic: string, payload: string, packet: Packet) {
    const [success, json] = parsePayload(payload)
    let showError = false

    const handlers = flatMap(Object.keys(this.subscriptions), key => {
      const subscription = this.subscriptions.get(key)
      return subscription.matchTopic(topic) ? subscription.handlers : []
    })

    handlers.forEach(({ callback, options }) => {
      if (shouldParseJson(options)) {
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
      console.log(`ignoring MQTT message for topic '${topic}': invalid JSON payload '${payload}'`)
    }
  }
}

function parsePayload(payload: string) {
  try {
    return [true, JSON.parse(payload)]
  } catch (error) {
    return [payload.length === 0, undefined]
  }
}

function flatMap(items: string[], fun: (key: string) => {}) {
  return Array.prototype.concat(...items.map(fun))
}
