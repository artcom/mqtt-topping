import { query } from "./queryWrapper";

function isUpperCase(string: string) {
  return string.toUpperCase() === string
}

export function isEventOrCommand(topic: string) {
  const lastTopicLevel = topic.substr(topic.lastIndexOf("/") + 1)
  const prefix = lastTopicLevel.substr(0, 2)

  return lastTopicLevel.length > 2
    && (prefix === "on" || prefix === "do")
    && isUpperCase(lastTopicLevel.charAt(2))
}

export function matchTopic(subscription: string) {
  const subLevels = subscription.split("/")
  const wildcardIndex = subLevels[subLevels.length - 1] === "#" ? subLevels.length - 1 : Infinity

  return (topic: string) => {
    const topLevels = topic.split("/")
    const length = Math.min(wildcardIndex, Math.max(subLevels.length, topLevels.length))

    for (let i = 0; i < length; i++) {
      const sub = subLevels[i]
      const top = topLevels[i]
      const match = sub === top || sub === "+" && top !== undefined

      if (!match) {
        return false
      }
    }

    return true
  }
}

export function shouldParseJson(query: query) {
  return query.parseJson != null ? query.parseJson : true
}
