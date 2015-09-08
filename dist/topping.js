"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _clientWrapper = require("./clientWrapper");

var _clientWrapper2 = _interopRequireDefault(_clientWrapper);

var _queryWrapper = require("./queryWrapper");

var _queryWrapper2 = _interopRequireDefault(_queryWrapper);

module.exports = {
  connect: function connect(uri) {
    return new _clientWrapper2["default"](uri);
  },
  query: function query(uri) {
    return new _queryWrapper2["default"](uri);
  }
};