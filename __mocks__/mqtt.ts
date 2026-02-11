import { Packet, MqttClient } from "mqtt"

// Simple event listener storage for the mock
const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}

export const MqttClientMock: jest.Mocked<Partial<MqttClient>> & {
  _emit: (event: string, ...args: unknown[]) => void
} = {
  subscribeAsync: jest.fn().mockImplementation(() => {
    return Promise.resolve([] as unknown[])
  }),
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
