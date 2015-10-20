import _ from "lodash"
import mqtt from "mqtt"

import QueryWrapper from "./queryWrapper"
import {isEventOrCommand, topicRegexp} from "./helpers"

export default class ClientWrapper {
  constructor(tcpUri, httpUri, options, connectCallback) {
    if (_.isFunction(options)) {
      connectCallback = options
      options = undefined
    }

    this.client = mqtt.connect(tcpUri, options)
    this.connectCallback = connectCallback
    this.subscriptions = {}

    this.client.on("connect", this.handleConnect.bind(this))
    this.client.on("close", this.handleClose.bind(this))
    this.client.on("message", this.handleMessage.bind(this))

    this.queryWrapper = new QueryWrapper(httpUri)
  }

  query(query) {
    return this.queryWrapper.send(query)
  }

  publish(topic, payload) {
    return new Promise((resolve, reject) => {
      const retain = !isEventOrCommand(topic)
      this.client.publish(topic, JSON.stringify(payload), { retain: retain, qos: 2 }, resolve)
    })
  }

  unpublish(topic) {
    return new Promise((resolve, reject) => {
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
      const unpublishPromises = _(subtopics)
        .filter((subtopic) => subtopic.payload)
        .map((subtopic) => this.unpublish(subtopic.topic))
        .value()

      return Promise.all(unpublishPromises)
    })
  }

  subscribe(topic, handler) {
    return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
      const subscription = this.subscriptions[topic]

      if (subscription) {
        subscription.handlers = _.without(subscription.handlers, handler)

        if (_.isEmpty(subscription.handlers)) {
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

    if (this.connectCallback) {
      this.connectCallback()
    }

    Object.keys(this.subscriptions).forEach((topic) => {
      this.client.subscribe(topic, { qos: 2 })
    })
  }

  handleClose() {
    this.isConnected = false
  }

  handleMessage(topic, json, packet) {
    let payload

    try {
      payload = JSON.parse(json)
    } catch (error) {
      console.log(`Ignoring MQTT message for topic '${topic}' ` +
                  `with invalid JSON payload '${json}'`)
    }

    if (payload !== undefined) {
      _.forOwn(this.subscriptions, (subscription) => {
        if (subscription.regexp.test(topic)) {
          subscription.handlers.forEach((handler) => {
            handler(payload, topic, packet)
          })
        }
      })
    }
  }
}
