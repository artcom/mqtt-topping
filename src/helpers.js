function isUpperCase(string) {
  return string.toUpperCase() === string
}

export function isEventOrCommand(topic) {
  const lastSlash = topic.lastIndexOf("/")
  const prefix = topic.substr(lastSlash + 1, 2)
  return topic.length > 2
    && (prefix === "on" || prefix === "do")
    && isUpperCase(topic.charAt(lastSlash + 3))
}

function escapeRegExp(string){
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function topicRegexp(topic) {
  const string = "^" + escapeRegExp(topic)
    .replace(/\/\\\+/g, "\/[^\/]*")
    .replace(/\/#$/g, "(\/.*)?") + "$"
  return new RegExp(string)
}
