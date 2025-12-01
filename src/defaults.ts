import { PayloadParseType } from "./mqtt/types"

export const KEEP_ALIVE = 30
export const CONNECT_TIMEOUT = 30 * 1000
export const QUALITY_OF_SERVICE = 2
export const DEFAULT_PARSE_TYPE: PayloadParseType = "json"
export const HTTP_REQUEST_TIMEOUT = 30 * 1000
