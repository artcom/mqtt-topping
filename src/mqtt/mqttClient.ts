import * as mqtt from "mqtt"
import type {
  MqttClient as MqttJsClient,
  Packet,
  IClientUnsubscribeProperties,
} from "mqtt"

// Universal import handling for both ESM (Vite) and CJS (Jest)
// @ts-expect-error - Handle potential default export difference
const mqttModule = mqtt.default || mqtt
const { connectAsync } = mqttModule
import {
  SubscribeOptions,
  PublishOptions,
  SubscriptionHandler,
  MessageCallback,
  ClientOptions,
  MqttResult,
  ParseErrorCallback,
} from "./types"

import { QoS } from "mqtt-packet"

import { HttpClient } from "../http/httpClient"
import { FlatTopicResult } from "../http/types"

import {
  MqttConnectionError,
  MqttSubscribeError,
  MqttUnsubscribeError,
  MqttPublishError,
  MqttPayloadError,
  MqttUsageError,
  MqttDisconnectError,
  InvalidTopicError,
} from "../errors"
import {
  matchTopic,
  isEventOrCommand,
  processOptions,
  validateTopic,
  processHandlersForTopic,
  validateTopicForPublish,
} from "./helpers"
import { QUALITY_OF_SERVICE, DEFAULT_PARSE_TYPE } from "../defaults"

export interface UnpublishRecursivelyOptions {
  batchSize?: number
  delayMs?: number
}

export class MqttClient {
  public readonly underlyingClient: MqttJsClient
  private readonly subscriptions: Record<
    string,
    { handlers: SubscriptionHandler[] }
  >
  private readonly onParseError?: ParseErrorCallback
  private messageHandler: (
    topic: string,
    payload: Buffer | Uint8Array, // MQTT.js provides Buffer in Node.js, Uint8Array in browser
    packet: Packet,
  ) => void
  private errorHandler: (error: Error) => void

  private constructor(
    private readonly client: MqttJsClient,
    onParseError?: ParseErrorCallback,
  ) {
    this.underlyingClient = client
    this.subscriptions = {}
    this.onParseError = onParseError

    this.messageHandler = (topic, payload, packet) => {
      this._handleMessage(topic, payload, packet)
    }
    this.client.on("message", this.messageHandler)

    // Prevent unhandled 'error' events from crashing the process.
    // Consumers can listen for errors directly via client.underlyingClient.on('error', ...)
    this.errorHandler = () => {}
    this.client.on("error", this.errorHandler)
  }

  public static async connect(
    uri: string,
    options: ClientOptions = {},
  ): Promise<MqttClient> {
    if (!uri) {
      throw new MqttUsageError("MQTT broker URI is required")
    }

    if (
      uri.startsWith("ws:") ||
      uri.startsWith("wss:") ||
      uri.startsWith("http:") ||
      uri.startsWith("https:") ||
      uri.startsWith("tcp:")
    ) {
      try {
        new URL(uri)
      } catch (error) {
        throw new MqttUsageError(
          `Invalid MQTT broker URI format for provided scheme: ${uri}`,
          {
            cause: error,
          },
        )
      }
    }

    const { finalOptions, onParseError } = processOptions(options)

    try {
      const mqttClient = await connectAsync(uri, finalOptions)
      return new MqttClient(mqttClient, onParseError)
    } catch (error) {
      throw new MqttConnectionError(
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
    }
  }

  public async subscribe(
    topic: string,
    callback: MessageCallback,
    opts?: SubscribeOptions,
  ): Promise<void> {
    validateTopic(topic)

    if (!callback || typeof callback !== "function") {
      throw new MqttUsageError("subscribe requires a valid callback function")
    }

    const parseType = opts?.parseType ?? DEFAULT_PARSE_TYPE
    const qos = opts?.qos ?? QUALITY_OF_SERVICE

    try {
      let needsBrokerSubscribe = false
      if (!this.subscriptions[topic]) {
        this.subscriptions[topic] = { handlers: [] }
        needsBrokerSubscribe = true
      }

      const handlerExists = this.subscriptions[topic].handlers.some(
        (handler) => handler.callback === callback,
      )

      if (handlerExists) {
        this.subscriptions[topic].handlers = this.subscriptions[
          topic
        ].handlers.map((handler) =>
          handler.callback === callback
            ? { ...handler, qos, parseType, customParser: opts?.customParser }
            : handler,
        )
      } else {
        this.subscriptions[topic].handlers.push({
          callback,
          qos,
          parseType,
          customParser: opts?.customParser,
        })

        if (needsBrokerSubscribe) {
          const subscribeOptions = {
            qos: qos,
            ...(opts?.properties ? { properties: opts.properties } : {}),
          }
          await this.client.subscribeAsync(topic, subscribeOptions)
        }
      }
    } catch (error) {
      if (this.subscriptions[topic]) {
        this.subscriptions[topic].handlers = this.subscriptions[
          topic
        ].handlers.filter((h) => h.callback !== callback)

        if (this.subscriptions[topic].handlers.length === 0) {
          delete this.subscriptions[topic]
        }
      }

      throw new MqttSubscribeError(
        topic,
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
    }
  }

  public async unsubscribe(
    topic: string,
    callback: MessageCallback,
    opts?: IClientUnsubscribeProperties,
  ): Promise<MqttResult | void> {
    validateTopic(topic)

    if (!callback || typeof callback !== "function") {
      throw new MqttUsageError("unsubscribe requires a valid callback function")
    }

    const subscription = this.subscriptions[topic]
    if (!subscription) {
      return
    }

    try {
      const originalHandlerCount = subscription.handlers.length
      subscription.handlers = subscription.handlers.filter(
        (handler) => handler.callback !== callback,
      )

      if (subscription.handlers.length === originalHandlerCount) {
        return
      }

      if (subscription.handlers.length === 0) {
        delete this.subscriptions[topic]

        const packet = await this.client.unsubscribeAsync(
          topic,
          opts || { properties: undefined },
        )

        return packet ? { packet } : undefined
      }
    } catch (error) {
      throw new MqttUnsubscribeError(
        topic,
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
    }
  }

  public async forceUnsubscribe(
    topic: string,
    opts?: IClientUnsubscribeProperties,
  ): Promise<MqttResult | void> {
    validateTopic(topic)

    const subscription = this.subscriptions[topic]
    if (!subscription) {
      return
    }

    try {
      delete this.subscriptions[topic]

      const packet = await this.client.unsubscribeAsync(
        topic,
        opts || { properties: undefined },
      )

      return packet ? { packet } : undefined
    } catch (error) {
      throw new MqttUnsubscribeError(
        topic,
        `forceUnsubscribe failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }
  public async publish(
    topic: string,
    data: unknown,
    opts?: PublishOptions,
  ): Promise<MqttResult | void> {
    validateTopicForPublish(topic)

    const qos = opts?.qos ?? QUALITY_OF_SERVICE
    const retain = opts?.retain ?? !isEventOrCommand(topic)
    let payload: string | Buffer | undefined

    try {
      const parseType = opts?.parseType ?? DEFAULT_PARSE_TYPE

      switch (parseType) {
        case "buffer":
          if (typeof Buffer !== "undefined") {
            payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data))
          } else {
            payload = String(data)
          }
          break
        case "string":
          payload = String(data)
          break
        case "json":
        default:
          try {
            if (data === undefined) {
              payload = ""
            } else {
              payload = JSON.stringify(data)
            }
          } catch (jsonError) {
            throw new MqttPayloadError(
              `Failed to JSON stringify payload: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
              { cause: jsonError, topic: topic, rawPayload: data },
            )
          }
          break
      }

      const packet = await this.client.publishAsync(topic, payload, {
        qos,
        retain,
        ...(opts?.properties ? { properties: opts.properties } : {}),
      })
      return packet ? { packet } : undefined
    } catch (error) {
      if (
        error instanceof MqttPayloadError ||
        error instanceof MqttUsageError ||
        error instanceof InvalidTopicError
      ) {
        throw error
      }

      throw new MqttPublishError(
        topic,
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
    }
  }

  public async unpublishRecursively(
    topic: string,
    httpClient: HttpClient,
    options?: UnpublishRecursivelyOptions,
  ): Promise<void> {
    validateTopicForPublish(topic)

    const batchSize = options?.batchSize ?? 100
    const delayMs = options?.delayMs ?? 10

    const queryResult = await httpClient.query({
      topic,
      depth: -1,
      flatten: true,
      parseJson: false,
    })

    const topicsToUnpublish = (queryResult as FlatTopicResult[]).map(
      (r) => r.topic,
    )

    if (topicsToUnpublish.length === 0) {
      return
    }

    for (let i = 0; i < topicsToUnpublish.length; i += batchSize) {
      const batch = topicsToUnpublish.slice(i, i + batchSize)

      await Promise.all(batch.map((t) => this.unpublish(t)))

      if (delayMs > 0 && i + batchSize < topicsToUnpublish.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  public async unpublish(
    topic: string,
    qos: QoS = QUALITY_OF_SERVICE,
  ): Promise<MqttResult | void> {
    validateTopicForPublish(topic)

    return this.publish(topic, undefined, {
      qos,
      retain: true,
    })
  }

  private _handleMessage(
    topic: string,
    payload: Buffer | Uint8Array, // MQTT.js provides Buffer in Node.js, Uint8Array in browser
    packet: Packet,
  ): void {
    let firstParsingError: Error | null = null

    const tryProcess = (subscription: {
      handlers: SubscriptionHandler[]
    }): Error | null => {
      return processHandlersForTopic(subscription, topic, payload, packet)
    }

    const exactSubscription = this.subscriptions[topic]
    if (exactSubscription) {
      const error = tryProcess(exactSubscription)
      if (error && !firstParsingError) firstParsingError = error
    }

    for (const subscriptionTopic of Object.keys(this.subscriptions)) {
      if (subscriptionTopic === topic) continue

      if (!subscriptionTopic.includes("+") && !subscriptionTopic.includes("#"))
        continue

      const subscription = this.subscriptions[subscriptionTopic]
      if (!subscription?.handlers?.length) continue

      const matchFn = matchTopic(subscriptionTopic)

      if (matchFn(topic)) {
        const error = tryProcess(subscription)
        if (error && !firstParsingError) firstParsingError = error
      }
    }

    if (firstParsingError) {
      if (this.onParseError) {
        this.onParseError(firstParsingError, topic, payload)
      }
    }
  }

  public async disconnect(force?: boolean | undefined): Promise<void> {
    this._removeAllEventListeners()

    const topics = Object.keys(this.subscriptions)
    if (topics.length > 0) {
      try {
        await this.client.unsubscribeAsync(topics)
      } catch {
        // Best-effort cleanup — connection may already be lost
      } finally {
        this._clearAllSubscriptions()
      }
    }

    try {
      await this.client.endAsync(force ?? false)
    } catch (error) {
      throw new MqttDisconnectError(
        `Failed to end MQTT connection: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }

  private _removeAllEventListeners(): void {
    if (this.messageHandler) {
      this.client.removeListener("message", this.messageHandler)
    }
    if (this.errorHandler) {
      this.client.removeListener("error", this.errorHandler)
    }
  }

  private _clearAllSubscriptions(): void {
    for (const topic in this.subscriptions) {
      delete this.subscriptions[topic]
    }
  }

  public isConnected(): boolean {
    return this.client.connected
  }

  public isReconnecting(): boolean {
    return this.client.reconnecting
  }
}
