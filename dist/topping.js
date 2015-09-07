"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _mqtt = require("mqtt");

var _mqtt2 = _interopRequireDefault(_mqtt);

var _clientWrapper = require("./clientWrapper");

var _clientWrapper2 = _interopRequireDefault(_clientWrapper);

var _queryWrapper = require("./queryWrapper");

var _queryWrapper2 = _interopRequireDefault(_queryWrapper);

module.exports = {
  connect: function connect(uri) {
    return new Promise(function (resolve, reject) {
      var client = _mqtt2["default"].connect(uri);
      client.once("connect", function () {
        resolve(new _clientWrapper2["default"](client));
      });
    });
  },
  query: function query(uri) {
    return new _queryWrapper2["default"](uri);
  }
};