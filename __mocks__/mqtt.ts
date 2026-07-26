import { jest } from "@jest/globals"
import { EventEmitter } from "node:events"
import type { MqttClient, ISubscriptionGrant, Packet } from "mqtt"

// Inherits real listener bookkeeping and a synchronous `emit` from EventEmitter,
// so tests can drive the client through the same event path MQTT.js uses.
export class MockMqttClient extends EventEmitter {
  connected = false
  reconnecting = false

  subscribeAsync = jest
    .fn<
      (topic: string | string[], opts?: object) => Promise<ISubscriptionGrant[]>
    >()
    .mockResolvedValue([])

  unsubscribeAsync = jest
    .fn<
      (topic: string | string[], opts?: object) => Promise<Packet | undefined>
    >()
    .mockResolvedValue({} as Packet)

  publishAsync = jest
    .fn<
      (
        topic: string,
        payload: string | Buffer,
        opts?: object,
      ) => Promise<Packet | undefined>
    >()
    .mockResolvedValue({} as Packet)

  endAsync = jest.fn<(force?: boolean) => Promise<void>>().mockResolvedValue()

  end = jest.fn()
}

// A fresh double per connect, so no state leaks between clients or tests.
export const connectAsync = jest.fn(
  async () => new MockMqttClient() as unknown as MqttClient,
)

// The one deliberate cast: the double implements only what the client uses.
export const asMock = (client: MqttClient): MockMqttClient =>
  client as unknown as MockMqttClient
