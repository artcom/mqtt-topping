function isUpperCase(string) {
  return string.toUpperCase() === string
}

export function isEventOrCommand(topic) {
  const lastTopicLevel = topic.substr(topic.lastIndexOf("/") + 1)
  const prefix = lastTopicLevel.substr(0, 2)

  return lastTopicLevel.length > 2
    && (prefix === "on" || prefix === "do")
    && isUpperCase(lastTopicLevel.charAt(2))
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function topicRegexp(topic) {
  const string = escapeRegExp(topic)
    .replace(/\/\\\+/g, "\/[^\/]*")
    .replace(/\/#$/g, "(\/.*)?")
  return new RegExp("^" + string + "$")
}
