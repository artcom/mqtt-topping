"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _mqtt = require("mqtt");

var _mqtt2 = _interopRequireDefault(_mqtt);

var _helpers = require("./helpers");

var ClientWrapper = (function () {
  function ClientWrapper(uri) {
    _classCallCheck(this, ClientWrapper);

    this.client = _mqtt2["default"].connect(uri);
    this.subscriptions = {};

    this.client.on("connect", this.handleConnect.bind(this));
    this.client.on("close", this.handleClose.bind(this));
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
        var subscribe = false;

        if (!_this2.subscriptions[topic]) {
          subscribe = true;
          _this2.subscriptions[topic] = {
            regexp: (0, _helpers.topicRegexp)(topic),
            handlers: []
          };
        }

        _this2.subscriptions[topic].handlers.push(handler);

        if (subscribe && _this2.isConnected) {
          _this2.client.subscribe(topic, resolve);
        } else {
          resolve();
        }
      });
    }
  }, {
    key: "unsubscribe",
    value: function unsubscribe(topic, handler) {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        var subscription = _this3.subscriptions[topic];

        if (subscription) {
          subscription.handlers = _lodash2["default"].without(subscription.handlers, handler);

          if (_lodash2["default"].isEmpty(subscription.handlers)) {
            _this3.client.unsubscribe(topic, resolve);
            delete _this3.subscriptions[topic];
          } else {
            resolve();
          }
        }
      });
    }
  }, {
    key: "handleConnect",
    value: function handleConnect() {
      var _this4 = this;

      this.isConnected = true;

      Object.keys(this.subscriptions).forEach(function (topic) {
        _this4.client.subscribe(topic);
      });
    }
  }, {
    key: "handleClose",
    value: function handleClose() {
      this.isConnected = false;
    }
  }, {
    key: "handleMessage",
    value: function handleMessage(topic, json, packet) {
      var _this5 = this;

      try {
        (function () {
          var payload = JSON.parse(json);

          _lodash2["default"].forOwn(_this5.subscriptions, function (subscription) {
            if (subscription.regexp.test(topic)) {
              subscription.handlers.forEach(function (handler) {
                handler(payload, topic, packet);
              });
            }
          });
        })();
      } catch (error) {
        // ignore exceptions during JSON parsing
      }
    }
  }]);

  return ClientWrapper;
})();

exports["default"] = ClientWrapper;
module.exports = exports["default"];