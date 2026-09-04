const listeners: Record<string, Function[]> = {};

const mock = {
  supportsOnDeviceRecognition: jest.fn(() => true),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  addListener: jest.fn((event: string, cb: Function) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
    return () => {
      listeners[event] = listeners[event].filter((fn) => fn !== cb);
    };
  }),
  androidTriggerOfflineModelDownload: jest.fn(),
  _emit: (event: string, data: any) => {
    (listeners[event] || []).forEach((cb) => cb(data));
  },
  _clearListeners: () => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
  },
};

export default mock;
