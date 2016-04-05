import zip from "lodash.zip"

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

  function matchLevel([sub, top], index) {
    return sub === top || sub === "+" && top !== undefined || index >= wildcardIndex
  }

  return (topic) => {
    const topLevels = topic.split("/")
    return zip(subLevels, topLevels).every(matchLevel)
  }
}
