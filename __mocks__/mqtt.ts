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
//
// Tests import this helper from "../../__mocks__/mqtt" directly, which evaluates
// this file a second time alongside the copy Jest substitutes for "mqtt". That is
// harmless for a pure cast, but it means `MockMqttClient` must only ever be
// imported as a *type* (`import type`): the class object seen by a test is not the
// one the client was constructed from, so `instanceof MockMqttClient` would be
// false. Assert on the double's fields, never on its identity.
export const asMock = (client: MqttClient): MockMqttClient =>
  client as unknown as MockMqttClient
