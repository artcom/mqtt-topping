import { Packet, MqttClient } from "mqtt"

type PacketCallback = (error?: Error | null, packet?: Packet) => void
type ClientSubscribeCallback = (err: Error | null, granted: unknown[]) => void

export const MqttClientMock: jest.Mocked<Partial<MqttClient>> = {
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
  on: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  end: jest.fn(),
  connected: false,
  reconnecting: false,
}

export const connectAsync = jest.fn().mockImplementation((): MqttClient => {
  return MqttClientMock as unknown as MqttClient // Cast needed because the mock is partial and wrapped by Jest
})
