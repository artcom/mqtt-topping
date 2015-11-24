import forOwn from "lodash.forown"
import without from "lodash.without"
import mqtt from "mqtt"

import QueryWrapper from "./queryWrapper"
import {isEventOrCommand, topicRegexp} from "./helpers"

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

  query(query) {
    return this.queryWrapper.send(query)
  }

  publish(topic, payload) {
    return new Promise((resolve) => {
      const retain = !isEventOrCommand(topic)
      this.client.publish(topic, JSON.stringify(payload), { retain: retain, qos: 2 }, resolve)
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

  subscribe(topic, handler) {
    return new Promise((resolve) => {
      let subscribe = false

      if (!this.subscriptions[topic]) {
        subscribe = true
        this.subscriptions[topic] = {
          regexp: topicRegexp(topic),
          handlers: []
        }
      }

      this.subscriptions[topic].handlers.push(handler)

      if (subscribe && this.isConnected) {
        this.client.subscribe(topic, { qos: 2 }, resolve)
      } else {
        resolve()
      }
    })
  }

  unsubscribe(topic, handler) {
    return new Promise((resolve) => {
      const subscription = this.subscriptions[topic]

      if (subscription) {
        subscription.handlers = without(subscription.handlers, handler)

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

  handleMessage(topic, json, packet) {
    const [success, payload] = parsePayload(json)

    if (success) {
      this.callHandlers(topic, payload, packet)
    } else {
      console.log(`Ignoring MQTT message for topic '${topic}' ` +
                  `with invalid JSON payload '${json}'`)
    }
  }

  callHandlers(topic, payload, packet) {
    forOwn(this.subscriptions, (subscription) => {
      if (subscription.regexp.test(topic)) {
        subscription.handlers.forEach((handler) => {
          handler(payload, topic, packet)
        })
      }
    })
  }
}

function parsePayload(payload) {
  try {
    return [true, JSON.parse(payload)]
  } catch (error) {
    return [payload.length === 0, undefined]
  }
}
