import { Packet, MqttClient } from "mqtt"

type PacketCallback = (error?: Error | null, packet?: Packet) => void
type ClientSubscribeCallback = (err: Error | null, granted: unknown[]) => void

// Simple event listener storage for the mock
const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}

export const MqttClientMock: jest.Mocked<Partial<MqttClient>> & {
  _emit: (event: string, ...args: unknown[]) => void
} = {
  publish: jest
    .fn()
    .mockImplementation(
      (
        _topic: string,
        _message: string | Buffer,
        _optsOrCb?: object | PacketCallback,
        _cb?: PacketCallback,
      ) => {
        let callback: PacketCallback | undefined
        if (typeof _optsOrCb === "function") {
          callback = _optsOrCb as PacketCallback
        } else if (typeof _cb === "function") {
          callback = _cb
        }
        callback?.(null, {} as Packet)
        return MqttClientMock
      },
    ),
  subscribe: jest
    .fn()
    .mockImplementation(
      (
        _topic: string | string[],
        _optsOrCb: object | ClientSubscribeCallback,
        maybeCb?: ClientSubscribeCallback,
      ) => {
        if (typeof _optsOrCb === "function") {
          ;(_optsOrCb as ClientSubscribeCallback)(null, [])
        } else {
          maybeCb?.(null, [])
        }
        return MqttClientMock
      },
    ),
  subscribeAsync: jest.fn().mockImplementation(() => {
    return Promise.resolve([] as unknown[])
  }),
  unsubscribe: jest
    .fn()
    .mockImplementation(
      (
        _topic: string | string[],
        _optsOrCb: object | PacketCallback,
        maybeCb?: PacketCallback,
      ) => {
        if (typeof _optsOrCb === "function") {
          ;(_optsOrCb as PacketCallback)(null, {} as Packet)
        } else {
          maybeCb?.(null, {} as Packet)
        }
        return MqttClientMock
      },
    ),
  unsubscribeAsync: jest.fn().mockResolvedValue({} as Packet),
  publishAsync: jest.fn().mockResolvedValue({} as Packet),
  endAsync: jest.fn().mockResolvedValue(undefined),
  on: jest
    .fn()
    .mockImplementation(
      (event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners[event]) {
          listeners[event] = []
        }
        listeners[event].push(handler)
        return MqttClientMock
      },
    ),
  removeListener: jest
    .fn()
    .mockImplementation(
      (event: string, handler: (...args: unknown[]) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler)
        }
        return MqttClientMock
      },
    ),
  removeAllListeners: jest.fn().mockImplementation((event?: string) => {
    if (event) {
      delete listeners[event]
    } else {
      for (const key in listeners) {
        delete listeners[key]
      }
    }
    return MqttClientMock
  }),
  _emit: (event: string, ...args: unknown[]) => {
    if (listeners[event]) {
      for (const handler of listeners[event]) {
        handler(...args)
      }
    }
  },
  end: jest.fn(),
  connected: false,
  reconnecting: false,
}

export const connectAsync = jest.fn().mockImplementation((): MqttClient => {
  // Clear listeners from previous test
  for (const key in listeners) {
    delete listeners[key]
  }
  return MqttClientMock as unknown as MqttClient // Cast needed because the mock is partial and wrapped by Jest
})
