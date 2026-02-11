export class MqttToppingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = this.constructor.name
  }
}

export class MqttError extends MqttToppingError {}

export class InvalidTopicError extends MqttError {
  constructor(message: string) {
    super(`Invalid topic - ${message}`)
  }
}

export class MqttConnectionError extends MqttError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`MQTT Connection Error: ${message}`, options)
  }
}

class MqttTopicError extends MqttError {
  public readonly topic: string | string[]
  constructor(
    prefix: string,
    topic: string | string[],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`${prefix} for topic(s) "${String(topic)}": ${message}`, options)
    this.topic = topic
  }
}

export class MqttSubscribeError extends MqttTopicError {
  constructor(
    topic: string | string[],
    message: string,
    options?: { cause?: unknown },
  ) {
    super("MQTT Subscribe Error", topic, message, options)
  }
}

export class MqttUnsubscribeError extends MqttTopicError {
  constructor(
    topic: string | string[],
    message: string,
    options?: { cause?: unknown },
  ) {
    super("MQTT Unsubscribe Error", topic, message, options)
  }
}

export class MqttPublishError extends MqttTopicError {
  constructor(topic: string, message: string, options?: { cause?: unknown }) {
    super("MQTT Publish Error", topic, message, options)
  }
}

export class MqttPayloadError extends MqttError {
  public readonly topic?: string
  public readonly rawPayload?: unknown
  constructor(
    message: string,
    options?: { cause?: unknown; topic?: string; rawPayload?: unknown },
  ) {
    super(
      `MQTT Payload Error${options?.topic ? ` for topic "${options.topic}"` : ""}: ${message}`,
      options,
    )
    this.topic = options?.topic
    this.rawPayload = options?.rawPayload
  }
}

export class MqttUsageError extends MqttError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`MQTT Usage Error: ${message}`, options)
  }
}

export class MqttDisconnectError extends MqttError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`MQTT Disconnect Error: ${message}`, options)
  }
}

export class HttpError extends MqttToppingError {}

class HttpTopicError extends HttpError {
  public readonly topic?: string
  constructor(
    prefix: string,
    message: string,
    options?: { cause?: unknown; topic?: string },
  ) {
    super(
      `${prefix}${options?.topic ? ` for topic "${options.topic}"` : ""}: ${message}`,
      options,
    )
    this.topic = options?.topic
  }
}

export class HttpNetworkError extends HttpError {
  public readonly url: string
  constructor(url: string, message: string, options?: { cause?: unknown }) {
    super(`HTTP Network Error for URL "${url}": ${message}`, options)
    this.url = url
  }
}

export class HttpTimeoutError extends HttpNetworkError {
  constructor(url: string, timeoutMs: number, options?: { cause?: unknown }) {
    super(url, `Request timed out after ${timeoutMs}ms`, options)
    this.name = "HttpTimeoutError"
  }
}

export class HttpRequestError extends HttpError {
  public readonly url: string
  public readonly statusCode: number
  public readonly responseBody?: unknown

  constructor(
    url: string,
    statusCode: number,
    message: string,
    responseBody?: unknown,
    options?: { cause?: unknown },
  ) {
    super(
      `HTTP Request Error for URL "${url}": Status ${statusCode} - ${message}`,
      options,
    )
    this.url = url
    this.statusCode = statusCode
    this.responseBody = responseBody
  }
}

export class HttpQueryError extends HttpError {
  public readonly query?: unknown
  constructor(message: string, options?: { cause?: unknown; query?: unknown }) {
    super(`HTTP Query Error: ${message}`, options)
    this.query = options?.query
  }
}

export class HttpPayloadParseError extends HttpTopicError {
  constructor(message: string, options?: { cause?: unknown; topic?: string }) {
    super("HTTP Response Payload Parse Error", message, options)
  }
}

export class HttpServerError extends HttpError {
  public readonly topic: string
  public readonly serverError: unknown

  constructor(
    topic: string,
    serverError: unknown,
    options?: { cause?: unknown },
  ) {
    const errorMessage =
      typeof serverError === "string"
        ? serverError
        : serverError &&
            typeof serverError === "object" &&
            "message" in serverError
          ? String(serverError.message)
          : JSON.stringify(serverError)

    super(
      `Server reported error for topic "${topic}": ${errorMessage}`,
      options,
    )
    this.topic = topic
    this.serverError = serverError
  }
}

export class HttpProcessingError extends HttpTopicError {
  constructor(message: string, options?: { cause?: unknown; topic?: string }) {
    super("HTTP Response Processing Error", message, options)
  }
}
