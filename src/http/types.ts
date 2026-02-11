export interface HttpClientOptions {
  requestTimeoutMs?: number
}

export interface Query {
  topic: string
  depth?: number
  flatten?: boolean
  parseJson?: boolean
}

export interface TopicResult<P = unknown> {
  topic: string
  payload?: P
  children?: Array<TopicResult<P>>
}

export interface FlatTopicResult<P = unknown> {
  topic: string
  payload?: P
}

export interface ErrorResult<E = unknown> {
  topic: string
  error: E
}

export type QueryResult<P = unknown> =
  | TopicResult<P>
  | Array<FlatTopicResult<P>>

export type BatchQueryResponse<P = unknown, E = unknown> = Array<
  TopicResult<P> | FlatTopicResult<P>[] | ErrorResult<E>
>

export type BatchQueryResult<P = unknown, E = unknown> = Array<
  TopicResult<P> | FlatTopicResult<P>[] | ErrorResult<E> | Error
>
