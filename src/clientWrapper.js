import mqtt from "mqtt";

import {isEventOrCommand, topicRegexp} from "./helpers";

export default class ClientWrapper {
  constructor(uri) {
    this.client = mqtt.connect(uri);
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

  subscribe(topic, handler) {
    return new Promise((resolve, reject) => {
      const regexp = topicRegexp(topic);
      let subscribe = false;

      if (!this.subscriptions[topic]) {
        this.subscriptions[topic] = [];
        subscribe = true;
      }

      this.subscriptions[topic].push({handler, regexp});

      if (subscribe && this.isConnected) {
        this.client.subscribe(topic, resolve);
      } else {
        resolve();
      }
    });
  };

  handleConnect() {
    this.isConnected = true;

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

      Object.keys(this.subscriptions).forEach((key) => {
        this.subscriptions[key].forEach(({handler, regexp}) => {
          if (regexp.test(topic)) {
            handler(payload, topic, packet);
          }
        });
      });
    } catch (error) {
      // ignore exceptions during JSON parsing
    }
  }
}
