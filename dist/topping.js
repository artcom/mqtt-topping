"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var mqtt = require("mqtt");

function isUpperCase(string) {
  return string.toUpperCase() === string;
}

function isEventOrCommand(topic) {
  var prefix = topic.substr(0, 2);
  return topic.length > 2 && (prefix === "on" || prefix === "do") && isUpperCase(topic.charAt(2));
}

var ClientWrapper = (function () {
  function ClientWrapper(client) {
    _classCallCheck(this, ClientWrapper);

    this.client = client;
    this.subscriptions = {};

    this.client.on("message", this.handleMessage.bind(this));
  }

  _createClass(ClientWrapper, [{
    key: "publish",
    value: function publish(topic, payload) {
      var _this = this;

      return new Promise(function (resolve, reject) {
        var retain = !isEventOrCommand(topic);
        _this.client.publish(topic, JSON.stringify(payload), { retain: retain, qos: 2 }, resolve);
      });
    }
  }, {
    key: "subscribe",
    value: function subscribe(topic, handler, callback) {
      var subscribe = false;

      if (!this.subscriptions[topic]) {
        this.subscriptions[topic] = [];
        subscribe = true;
      }

      this.subscriptions[topic].push(handler);

      if (subscribe) {
        this.client.subscribe(topic, callback);
      } else if (callback) {
        callback();
      }
    }
  }, {
    key: "handleMessage",
    value: function handleMessage(topic, json) {
      var payload = JSON.parse(json);

      this.subscriptions[topic].forEach(function (callback) {
        callback(payload, topic);
      }, this);
    }
  }]);

  return ClientWrapper;
})();

module.exports = {
  connect: function connect(uri) {
    return new Promise(function (resolve, reject) {
      var client = mqtt.connect(uri);
      client.once("connect", function () {
        resolve(new ClientWrapper(client));
      });
    });
  }
};
//# sourceMappingURL=topping.js.map