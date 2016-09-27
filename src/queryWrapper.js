import axios from "axios"

import { shouldParseJson } from "./helpers"

export default class QueryWrapper {
  constructor(uri) {
    this.queryUri = `${uri}/query`
  }

  send(query) {
    if (Array.isArray(query)) {
      return this.sendBatch(query)
    } else {
      return this.sendSingle(query)
    }
  }

  sendJson(query) {
    if (Array.isArray(query)) {
      return this.sendBatch(query.map(makeJsonQuery))
        .then((results) => results.map(makeObject))
    } else {
      return this.sendSingle(makeJsonQuery(query))
        .then(makeObject)
        .catch(() => ({}))
    }
  }

  sendBatch(queries) {
    return axios.post(this.queryUri, queries.map(omitParseJson)).then(({ data }) =>
      data.map((result, index) => {
        const query = queries[index]

        if (shouldParseJson(query)) {
          try {
            parsePayloads(result)
          } catch (error) {
            return {
              topic: query.topic,
              error
            }
          }
        }

        return result
      })
    )
  }

  sendSingle(query) {
    return axios.post(this.queryUri, omitParseJson(query)).then(({ data }) => {
      if (shouldParseJson(query)) {
        parsePayloads(data)
      }

      return data
    }).catch(({ data }) => {
      throw data
    })
  }
}

function makeJsonQuery(query) {
  if (query.topic.includes("+")) {
    throw new Error("Wildcards are not supported in queryJson().")
  }

  return Object.assign({}, query, { depth: -1, parseJson: false })
}

function makeObject(result, isRoot = true) {
  if (result.children) {
    const object = {}

    result.children.forEach((child) => {
      const key = child.topic.split("/").pop()

      try {
        object[key] = makeObject(child, false)
      } catch (e) {
        // ignore children that contain invalid JSON
      }
    })

    return object
  } else if (!isRoot) {
    return JSON.parse(result.payload)
  } else {
    return {}
  }
}

function omitParseJson(query) {
  return Object.assign({}, query, {
    parseJson: undefined
  })
}

function parsePayloads(result) {
  if (Array.isArray(result)) {
    result.forEach(parsePayloads)
  } else {
    return parsePayload(result)
  }
}

function parsePayload(result) {
  if (result.payload) {
    result.payload = JSON.parse(result.payload)
  }

  if (result.children) {
    result.children.map(parsePayloads)
  }
}
