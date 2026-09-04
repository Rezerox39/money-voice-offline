export const canOpenURL = jest.fn().mockResolvedValue(true);
export const openURL = jest.fn().mockResolvedValue(undefined);
export const addEventListener = jest.fn();
export const removeEventListener = jest.fn();
export const getInitialURL = jest.fn().mockResolvedValue(null);
export const makeURL = jest.fn((path: string) => `exp://localhost:8081${path}`);
