import _ from "lodash";
import mqtt from "mqtt";

import {isEventOrCommand, topicRegexp} from "./helpers";

export default class ClientWrapper {
  constructor(uri, options, connectCallback) {
    if (_.isFunction(options)) {
      connectCallback = options;
      options = undefined;
    }

    this.client = mqtt.connect(uri, options);
    this.connectCallback = connectCallback;
    this.subscriptions = {};

    this.client.on("connect", this.handleConnect.bind(this));
    this.client.on("close", this.handleClose.bind(this));
    this.client.on("message", this.handleMessage.bind(this));
  }

  publish(topic, payload) {
    return new Promise((resolve, reject) => {
      const retain = !isEventOrCommand(topic);
      this.client.publish(topic, JSON.stringify(payload), { retain: retain, qos: 2 }, resolve);
    });
  }

  unpublish(topic) {
    return new Promise((resolve, reject) => {
      this.client.publish(topic, null, { retain: true, qos: 2 }, resolve);
    });
  }

  subscribe(topic, handler) {
    return new Promise((resolve, reject) => {
      let subscribe = false;

      if (!this.subscriptions[topic]) {
        subscribe = true;
        this.subscriptions[topic] = {
          regexp: topicRegexp(topic),
          handlers: []
        };
      }

      this.subscriptions[topic].handlers.push(handler);

      if (subscribe && this.isConnected) {
        this.client.subscribe(topic, resolve);
      } else {
        resolve();
      }
    });
  };

  unsubscribe(topic, handler) {
    return new Promise((resolve, reject) => {
      const subscription = this.subscriptions[topic];

      if (subscription) {
        subscription.handlers = _.without(subscription.handlers, handler);

        if (_.isEmpty(subscription.handlers)) {
          this.client.unsubscribe(topic, resolve);
          delete this.subscriptions[topic];
        } else {
          resolve();
        }
      }
    });
  }

  handleConnect() {
    this.isConnected = true;

    if (this.connectCallback) {
      this.connectCallback();
    }

    Object.keys(this.subscriptions).forEach((topic) => {
      this.client.subscribe(topic);
    });
  }

  handleClose() {
    this.isConnected = false;
  }

  handleMessage(topic, json, packet) {
    try {
      const payload = JSON.parse(json);

      _.forOwn(this.subscriptions, (subscription) => {
        if (subscription.regexp.test(topic)) {
          subscription.handlers.forEach((handler) => {
            handler(payload, topic, packet);
          });
        }
      });
    } catch (error) {
      // ignore exceptions during JSON parsing
    }
  }
}
