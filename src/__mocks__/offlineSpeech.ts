export const checkOfflineModelStatus = jest.fn().mockResolvedValue({ available: true, message: 'OK' });
export const startOfflineRecognition = jest.fn().mockResolvedValue({ transcript: 'chai 30', confidence: 0.95 });
export const stopRecognition = jest.fn();
export const abortRecognition = jest.fn();
