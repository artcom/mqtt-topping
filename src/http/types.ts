export type Query = { topic: string; depth?: number; flatten?: boolean; parseJson?: boolean }

export type TopicResult = { topic: string; payload?: any; children?: Array<TopicResult> }
export type FlatTopicResult = { topic: string; payload?: any }
export type ErrorResult = { topic: string; error: any }

export type QueryResult = TopicResult | FlatTopicResult[]
export type BatchQueryResult = Array<TopicResult | FlatTopicResult[] | ErrorResult>
export type JsonResult = any
