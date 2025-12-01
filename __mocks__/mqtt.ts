// @ts-nocheck
export const MqttClientMock: jest.Mocked<Partial<MqttClient>> = {
  publish: jest.fn().mockImplementation((_msg: any, _opts: any, cb: any) => {
    cb?.(undefined, {} as Packet);
    return MqttClientMock;
  }),
  subscribe: jest.fn().mockImplementation((_topic: any, _optsOrCb: any, maybeCb: any) => {
    if (typeof _optsOrCb === "function") {
      _optsOrCb(undefined, {} as Packet);
    } else {
      maybeCb?.(undefined, {} as Packet);
    }
    return MqttClientMock;
  }),
  subscribeAsync: jest.fn().mockImplementation(() => {
    return Promise.resolve({} as Packet);
  }),
  unsubscribe: jest.fn().mockImplementation((_topic: any, _cbOrOpts: any, maybeCb: any) => {
    if (typeof _cbOrOpts === "function") {
      _cbOrOpts(undefined, {} as Packet);
    } else {
      maybeCb?.(undefined, {} as Packet);
    }
    return MqttClientMock;
  }),
  unsubscribeAsync: jest.fn().mockResolvedValue({} as Packet),
  publishAsync: jest.fn().mockResolvedValue({} as Packet),
  endAsync: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  end: jest.fn(),
  connected: false,
  reconnecting: false,
};

export const connectAsync = jest
  .fn()
  .mockImplementation((): MqttClient => {
    return MqttClientMock as unknown as MqttClient; // Cast needed because the mock is partial and wrapped by Jest
  })
