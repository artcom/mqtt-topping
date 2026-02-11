import {
  Query,
  TopicResult,
  FlatTopicResult,
  QueryResult,
  BatchQueryResult,
  BatchQueryResponse,
  ErrorResult,
  HttpClientOptions,
} from "./types"
import { HttpError, HttpServerError, HttpProcessingError } from "../errors"
import { errorMessage } from "../utils"
import {
  omitParseJson,
  makeJsonQuery,
  makeObject,
  parsePayloads,
  post,
} from "./helpers"
import { HTTP_REQUEST_TIMEOUT } from "../defaults"

export class HttpClient {
  private readonly requestTimeoutMs: number

  constructor(
    private readonly baseUrl: string,
    options?: HttpClientOptions,
  ) {
    this.requestTimeoutMs = options?.requestTimeoutMs ?? HTTP_REQUEST_TIMEOUT
  }

  public async query(query: Query): Promise<QueryResult> {
    const response = await post<QueryResult>(
      this.baseUrl,
      "/query",
      omitParseJson(query),
      this.requestTimeoutMs,
    )

    if (query.parseJson !== false) {
      parsePayloads(response, query.topic)
    }
    return response
  }

  public async queryBatch(queries: Query[]): Promise<BatchQueryResult> {
    const requestData = queries.map((q) => omitParseJson(q))
    const responses = await post<BatchQueryResponse>(
      this.baseUrl,
      "/query",
      requestData,
      this.requestTimeoutMs,
    )

    return responses.map((result, index) => {
      const originalQuery = queries[index]
      const { topic, parseJson = true } = originalQuery

      try {
        if (
          result &&
          typeof result === "object" &&
          "error" in result &&
          result.error
        ) {
          return new HttpServerError(result.topic ?? topic, result.error)
        }

        if (parseJson) {
          parsePayloads(result, topic)
        }

        return result as TopicResult | FlatTopicResult[]
      } catch (processError) {
        if (processError instanceof HttpError) {
          return processError
        } else {
          return new HttpProcessingError(
            `Failed to process batch result for topic ${topic}: ${errorMessage(processError)}`,
            { cause: processError, topic: topic },
          )
        }
      }
    })
  }

  public async queryJson(topic: string): Promise<unknown> {
    const jsonQuery = makeJsonQuery(topic)

    const result = await this.query(jsonQuery)

    if (Array.isArray(result)) {
      throw new HttpProcessingError(
        `Unexpected array result for non-wildcard queryJson: ${topic}`,
        { topic: topic },
      )
    }
    if (result && typeof result === "object" && "error" in result) {
      throw new HttpServerError(topic, (result as ErrorResult).error)
    }

    return makeObject(result as TopicResult)
  }

  public async queryJsonBatch(
    topics: string[],
  ): Promise<Array<unknown | HttpError>> {
    const jsonQueries = topics.map((t) => makeJsonQuery(t))

    const results = await this.queryBatch(jsonQueries)

    return results.map((result, index) => {
      const topic = topics[index]

      if (result instanceof HttpError) {
        return result
      }

      if (Array.isArray(result)) {
        return new HttpProcessingError(
          `Unexpected array result in queryJsonBatch for topic ${topic}`,
          { topic },
        )
      }

      try {
        return makeObject(result as TopicResult)
      } catch (processingError) {
        if (processingError instanceof HttpError) {
          return processingError
        } else {
          return new HttpProcessingError(
            `Failed makeObject for topic ${topic}: ${errorMessage(processingError)}`,
            { cause: processingError, topic: topic },
          )
        }
      }
    })
  }
}
