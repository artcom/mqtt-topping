"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isEventOrCommand = isEventOrCommand;
function isUpperCase(string) {
  return string.toUpperCase() === string;
}

function isEventOrCommand(topic) {
  var lastSlash = topic.lastIndexOf("/");
  var prefix = topic.substr(lastSlash + 1, 2);
  return topic.length > 2 && (prefix === "on" || prefix === "do") && isUpperCase(topic.charAt(lastSlash + 3));
}