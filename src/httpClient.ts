import axios from "axios"

import { FlatTopicResult, JsonResult, Query, TopicResult } from "./types"

export default class HttpClient {
  uri: string

  constructor(uri: string) {
    this.uri = uri
  }

  async queryJson(query: Query): Promise<JsonResult> {
    const jsonQuery = makeJsonQuery(query)

    try {
      const result = await this.query(jsonQuery)
      return makeObject(result as TopicResult)
    } catch (error) {
      return {}
    }
  }

  async queryJsonBatch(queries: Query[]): Promise<JsonResult[]> {
    const jsonQueries = queries.map(makeJsonQuery)

    const results = await this.queryBatch(jsonQueries)
    return results.map(result => makeObject(result))
  }

  queryBatch(queries: Query[]): Promise<TopicResult[]> {
    return axios.post(this.uri, queries.map(omitParseJson)).then(({ data }) =>
      data.map((result: TopicResult, index: number) => {
        const { topic, parseJson = true } = queries[index]

        if (parseJson) {
          try {
            parsePayloads(result)
          } catch (error) {
            return {
              topic,
              error
            }
          }
        }

        return result
      })
    )
  }

  query(query: Query): Promise<TopicResult | FlatTopicResult> {
    return axios.post(this.uri, omitParseJson(query)).then(({ data }) => {
      const { parseJson = true } = query
      if (parseJson) {
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

function makeJsonQuery(query: Query) {
  if (query.topic.includes("+")) {
    throw new Error("Wildcards are not supported in queryJson().")
  }

  return { ...query, depth: -1, parseJson: false }
}

function makeObject(result: TopicResult, isRoot = true): JsonResult {
  if (result.children) {
    const object: JsonResult = {}

    result.children.forEach(child => {
      const key = child.topic.split("/").pop() as string

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

function omitParseJson(query: Query) {
  const { parseJson, ...rest } = query
  return rest
}

function parsePayloads(result: TopicResult) {
  if (Array.isArray(result)) {
    result.forEach(parsePayloads)
  } else {
    return parsePayload(result)
  }
}

function parsePayload(result: TopicResult): void {
  if (result.payload) {
    result.payload = JSON.parse(result.payload) // eslint-disable-line no-param-reassign
  }

  if (result.children) {
    result.children.map(parsePayloads)
  }
}
