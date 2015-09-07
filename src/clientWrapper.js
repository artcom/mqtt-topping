import {isEventOrCommand, topicRegexp} from "./helpers";

export default class ClientWrapper {
  constructor(client) {
    this.client = client;
    this.subscriptions = {};

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

      if (subscribe) {
        this.client.subscribe(topic, resolve);
      } else {
        resolve();
      }
    });
  };

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
