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

export function matchTopic(subscription) {
  const subLevels = subscription.split("/")
  const wildcardIndex = subLevels.indexOf("#") === -1 ? Infinity : subLevels.indexOf("#")

  return (topic) => {
    const topLevels = topic.split("/")
    const length = Math.max(subLevels.length, topLevels.length)

    for (let i = 0; i < length; i++) {
      const sub = subLevels[i]
      const top = topLevels[i]
      const match = sub === top || sub === "+" && top !== undefined || i >= wildcardIndex

      if (!match) {
        return false
      }
    }

    return true
  }
}

export function shouldParseJson(query) {
  return query.parseJson != null ? query.parseJson : true
}
