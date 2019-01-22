import axios from "axios"

import { shouldParseJson } from "./helpers"

export type query = {
  topic: string,
  depth: number,
  parseJson: boolean,
  flatten: boolean
}

export type result = {
  topic: string,
  payload: any,
  children?: result[]
}

export default class QueryWrapper {
  queryUri: string

  constructor(uri: string) {
    this.queryUri = `${uri}/query`
  }

  send(query: query | query[]) {
    if (Array.isArray(query)) {
      return this.sendBatch(query)
    } else {
      return this.sendSingle(query)
    }
  }

  sendJson(query: query | query[]) {
    if (Array.isArray(query)) {
      return this.sendBatch(query.map(makeJsonQuery))
        .then(results => results.map(makeObject))
    } else {
      return this.sendSingle(makeJsonQuery(query))
        .then(makeObject)
        .catch(() => ({}))
    }
  }

  sendBatch(queries: query[]) {
    return axios.post(this.queryUri, queries.map(omitParseJson)).then(({ data }) =>
      data.map((result: result, index: number) => {
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

  sendSingle(query: query) {
    return axios.post(this.queryUri, omitParseJson(query)).then(({ data }) => {
      if (shouldParseJson(query)) {
        parsePayloads(data)
      }

      return data
    }).catch(error => {
      if (error.response) {
        throw error.response.data
      } else {
        throw error.message
      }
    })
  }
}

function makeJsonQuery(query: query) {
  if (query.topic.includes("+")) {
    throw new Error("Wildcards are not supported in queryJson().")
  }

  return Object.assign({}, query, { depth: -1, parseJson: false })
}

function makeObject(result: result, isRoot = true) {
  if (result.children) {
    const object: any = {}

    result.children.forEach(child => {
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

function omitParseJson(query: query) {
  return Object.assign({}, query, {
    parseJson: undefined
  })
}

function parsePayloads(result: result) {
  if (Array.isArray(result)) {
    result.forEach(parsePayloads)
  } else {
    return parsePayload(result)
  }
}

function parsePayload(result: result) {
  if (result.payload) {
    result.payload = JSON.parse(result.payload)
  }

  if (result.children) {
    result.children.map(parsePayloads)
  }
}
