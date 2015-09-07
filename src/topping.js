const mqtt = require("mqtt");

function isUpperCase(string) {
  return string.toUpperCase() === string;
}

function isEventOrCommand(topic) {
  const prefix = topic.substr(0, 2);
  return topic.length > 2 && (prefix === "on" || prefix === "do") && isUpperCase(topic.charAt(2));
}

class ClientWrapper {
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
      let subscribe = false;

      if (!this.subscriptions[topic]) {
        this.subscriptions[topic] = [];
        subscribe = true;
      }

      this.subscriptions[topic].push(handler);

      if (subscribe) {
        this.client.subscribe(topic, resolve);
      } else {
        resolve();
      }
    });
  };

  handleMessage(topic, json, packet) {
    const payload = JSON.parse(json);

    this.subscriptions[topic].forEach(function(callback) {
      callback(payload, topic, packet);
    }, this);
  }
}

module.exports = {
  connect: function(uri) {
    return new Promise(function(resolve, reject) {
      const client = mqtt.connect(uri)
      client.once("connect", function() {
        resolve(new ClientWrapper(client));
      });
    });
  }
}
