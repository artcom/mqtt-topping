import { jest } from "@jest/globals"
import { EventEmitter } from "node:events"
import type {
  MqttClient,
  IClientPublishOptions,
  IClientSubscribeOptions,
  IClientUnsubscribeProperties,
  ISubscriptionGrant,
  Packet,
} from "mqtt"

// Inherits real listener bookkeeping and a synchronous `emit` from EventEmitter,
// so tests can drive the client through the same event path MQTT.js uses.
export class MockMqttClient extends EventEmitter {
  connected = false
  reconnecting = false

  subscribeAsync = jest
    .fn<
      (
        topic: string | string[],
        opts?: IClientSubscribeOptions,
      ) => Promise<ISubscriptionGrant[]>
    >()
    .mockResolvedValue([])

  unsubscribeAsync = jest
    .fn<
      (
        topic: string | string[],
        opts?: IClientUnsubscribeProperties,
      ) => Promise<Packet | undefined>
    >()
    .mockResolvedValue({} as Packet)

  publishAsync = jest
    .fn<
      (
        topic: string,
        payload: string | Buffer,
        opts?: IClientPublishOptions,
      ) => Promise<Packet | undefined>
    >()
    .mockResolvedValue({} as Packet)

  endAsync = jest.fn<(force?: boolean) => Promise<void>>().mockResolvedValue()

  /**
   * Emits a broker message the way MQTT.js does. Prefer this over a raw
   * `emit("message", …)`: `EventEmitter.emit` is untyped, so a misspelled event
   * name or a wrong argument order silently reaches no listener and leaves
   * `not.toHaveBeenCalled()` assertions passing for the wrong reason.
   *
   * Returns whether any listener was registered, so tests that expect delivery
   * can assert the message was actually routed.
   */
  deliver(
    topic: string,
    payload: Buffer | Uint8Array,
    packet: Packet = {} as Packet,
  ): boolean {
    return this.emit("message", topic, payload, packet)
  }
}

// A fresh double per connect, so no state leaks between clients or tests.
export const connectAsync = jest.fn(
  async () => new MockMqttClient() as unknown as MqttClient,
)

// The one deliberate cast: the double implements only what the client uses.
export const asMock = (client: MqttClient): MockMqttClient =>
  client as unknown as MockMqttClient
