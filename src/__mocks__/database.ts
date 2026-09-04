export const addExpense = jest.fn().mockResolvedValue({ id: 'mock-expense-id' });
export const addPoolDeposit = jest.fn().mockResolvedValue({ id: 'mock-deposit-id' });
export const initDatabase = jest.fn().mockResolvedValue(undefined);
export const getAllTrips = jest.fn().mockResolvedValue([]);
export const getTripById = jest.fn().mockResolvedValue(null);

export const appendLedgerEvent = jest.fn().mockResolvedValue(undefined);
