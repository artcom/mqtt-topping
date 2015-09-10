"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _axios = require("axios");

var _axios2 = _interopRequireDefault(_axios);

var QueryWrapper = (function () {
  function QueryWrapper(uri) {
    _classCallCheck(this, QueryWrapper);

    this.queryUri = uri + "/query";
  }

  _createClass(QueryWrapper, [{
    key: "topic",
    value: function topic(_topic) {
      return this.sendQuery({ topic: _topic }).then(function (_ref) {
        var payload = _ref.payload;
        return JSON.parse(payload);
      });
    }
  }, {
    key: "subtopics",
    value: function subtopics(topic) {
      return this.sendQuery({ topic: topic, depth: 1 }).then(function (_ref2) {
        var children = _ref2.children;

        return (0, _lodash2["default"])(children || []).map(function (child) {
          return [(0, _lodash2["default"])(child.topic).split("/").last(), JSON.parse(child.payload)];
        }).zipObject().value();
      });
    }
  }, {
    key: "sendQuery",
    value: function sendQuery(query) {
      return _axios2["default"].post(this.queryUri, query).then(function (_ref3) {
        var data = _ref3.data;
        return data;
      });
    }
  }]);

  return QueryWrapper;
})();

exports["default"] = QueryWrapper;
module.exports = exports["default"];