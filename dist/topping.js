"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _mqtt = require("mqtt");

var _mqtt2 = _interopRequireDefault(_mqtt);

var _helpers = require("./helpers");

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
        var retain = !(0, _helpers.isEventOrCommand)(topic);
        _this.client.publish(topic, JSON.stringify(payload), { retain: retain, qos: 2 }, resolve);
      });
    }
  }, {
    key: "subscribe",
    value: function subscribe(topic, handler) {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        var regexp = (0, _helpers.topicRegexp)(topic);
        var subscribe = false;

        if (!_this2.subscriptions[topic]) {
          _this2.subscriptions[topic] = [];
          subscribe = true;
        }

        _this2.subscriptions[topic].push({ handler: handler, regexp: regexp });

        if (subscribe) {
          _this2.client.subscribe(topic, resolve);
        } else {
          resolve();
        }
      });
    }
  }, {
    key: "handleMessage",
    value: function handleMessage(topic, json, packet) {
      var _this3 = this;

      try {
        (function () {
          var payload = JSON.parse(json);

          Object.keys(_this3.subscriptions).forEach(function (key) {
            _this3.subscriptions[key].forEach(function (_ref) {
              var handler = _ref.handler;
              var regexp = _ref.regexp;

              if (regexp.test(topic)) {
                handler(payload, topic, packet);
              }
            });
          });
        })();
      } catch (error) {
        // ignore exceptions during JSON parsing
      }
    }
  }]);

  return ClientWrapper;
})();

module.exports = {
  connect: function connect(uri) {
    return new Promise(function (resolve, reject) {
      var client = _mqtt2["default"].connect(uri);
      client.once("connect", function () {
        resolve(new ClientWrapper(client));
      });
    });
  }
};