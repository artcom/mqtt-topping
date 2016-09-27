import mqtt from "mqtt"

import QueryWrapper from "./queryWrapper"
import { isEventOrCommand, matchTopic, shouldParseJson } from "./helpers"

export default class ClientWrapper {
  constructor(tcpUri, httpUri, options) {
    this.client = mqtt.connect(tcpUri, options)
    this.subscriptions = {}

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
    return new Promise((resolve) => {
      this.client.end(resolve)
    })
  }

  query(query) {
    return this.queryWrapper.send(query)
  }

  queryJson(query) {
    return this.queryWrapper.sendJson(query)
  }

  publish(topic, payload, { qos = 2, stringifyJson = true } = {}) {
    if (stringifyJson) {
      payload = JSON.stringify(payload)
    }

    return new Promise((resolve) => {
      const retain = !isEventOrCommand(topic)
      this.client.publish(topic, payload, { retain, qos }, resolve)
    })
  }

  unpublish(topic) {
    return new Promise((resolve) => {
      this.client.publish(topic, null, { retain: true, qos: 2 }, resolve)
    })
  }

  unpublishRecursively(topic) {
    return this.query({
      topic,
      depth: -1,
      flatten: true,
      parseJson: false
    }).then((subtopics) => {
      const unpublishPromises = subtopics.reduce((promises, subtopic) => {
        if (subtopic.payload) {
          promises.push(this.unpublish(subtopic.topic))
        }

        return promises
      }, [])

      return Promise.all(unpublishPromises)
    })
  }

  subscribe(topic, options, callback) {
    if (!callback) {
      callback = options
      options = {}
    }

    return new Promise((resolve) => {
      let subscribe = false

      if (!this.subscriptions[topic]) {
        subscribe = true
        this.subscriptions[topic] = {
          matchTopic: matchTopic(topic),
          handlers: []
        }
      }

      this.subscriptions[topic].handlers.push({ callback, options })

      if (subscribe && this.isConnected) {
        this.client.subscribe(topic, { qos: 2 }, resolve)
      } else {
        resolve()
      }
    })
  }

  unsubscribe(topic, callback) {
    return new Promise((resolve) => {
      const subscription = this.subscriptions[topic]

      if (subscription) {
        subscription.handlers = subscription.handlers.filter((handler) =>
          handler.callback !== callback
        )

        if (subscription.handlers.length === 0) {
          this.client.unsubscribe(topic, resolve)
          delete this.subscriptions[topic]
        } else {
          resolve()
        }
      }
    })
  }

  handleConnect() {
    this.isConnected = true

    Object.keys(this.subscriptions).forEach((topic) => {
      this.client.subscribe(topic, { qos: 2 })
    })
  }

  handleClose() {
    this.isConnected = false
  }

  handleMessage(topic, payload, packet) {
    const [success, json] = parsePayload(payload)
    let showError = false

    Object.keys(this.subscriptions).forEach((key) => {
      const subscription = this.subscriptions[key]

      if (subscription.matchTopic(topic)) {
        subscription.handlers.forEach(callHandler)
      }
    })

    function callHandler({ callback, options }) {
      if (shouldParseJson(options)) {
        if (success) {
          callback(json, topic, packet)
        } else {
          showError = true
        }
      } else {
        callback(payload.toString(), topic, packet)
      }
    }

    if (showError) {
      console.log(`ignoring MQTT message for topic '${topic}': invalid JSON payload '${payload}'`)
    }
  }
}

function parsePayload(payload) {
  try {
    return [true, JSON.parse(payload)]
  } catch (error) {
    return [payload.length === 0, undefined]
  }
}
