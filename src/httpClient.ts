import axios, { AxiosResponse } from "axios"

import { ErrorResult, QueryResult, JsonResult, Query, FlatTopicResult, TopicResult } from "./types"

export default class HttpClient {
  uri: string

  constructor(uri: string) {
    this.uri = uri
  }

  query(query: Query): Promise<QueryResult> {
    return axios.post<any, AxiosResponse<QueryResult>>(this.uri, omitParseJson(query))
      .then(({ data }) => {
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

  queryBatch(queries: Query[]): Promise<QueryResult[]> {
    return axios.post<any, AxiosResponse<QueryResult[]>>(this.uri, queries.map(omitParseJson))
      .then(({ data }) =>
        data.map((result: QueryResult, index: number) => {
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

  async queryJson(topic: string): Promise<JsonResult> {
    const jsonQuery = makeJsonQuery(topic)

    const result = await this.query(jsonQuery)
    return makeObject(result as TopicResult)
  }

  async queryJsonBatch(topics: string[]): Promise<JsonResult> {
    const jsonQueries = topics.map(makeJsonQuery)

    const results = (await this.queryBatch(jsonQueries)) as Array<TopicResult | ErrorResult>
    return results.map(result => {
      if ("error" in result) {
        return result
      }

      try {
        return makeObject(result)
      } catch (error) {
        return {
          topic: result.topic,
          error
        }
      }
    })
  }
}

function makeJsonQuery(topic: string): Query {
  if (topic.includes("+")) {
    throw new Error("Wildcards are not supported in queryJson().")
  }

  return { topic, depth: -1, parseJson: false, flatten: false }
}

function makeObject(result: TopicResult): JsonResult {
  if ("children" in result && result.children) {
    const object: JsonResult = {}

    result.children.forEach(child => {
      const key = child.topic.split("/").pop() as string
      object[key] = makeObject(child)
    })

    return object
  }

  return JSON.parse(result.payload)
}

function omitParseJson(query: Query): Query {
  const { parseJson, ...rest } = query
  return rest
}

function parsePayloads(result: QueryResult): void {
  if (Array.isArray(result)) {
    result.forEach(parsePayloads)
  } else {
    return parsePayload(result)
  }
}

function parsePayload(result: TopicResult | FlatTopicResult): void {
  if (result.payload) {
    result.payload = JSON.parse(result.payload) // eslint-disable-line no-param-reassign
  }

  if ("children" in result && result.children) {
    result.children.map(parsePayloads)
  }
}
