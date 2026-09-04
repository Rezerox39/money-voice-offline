/**
 * upi.test.ts — UPI Intent Dispatcher tests
 * Validates proper URI encoding, exact decimal formatting,
 * and canOpenURL/openURL behavior.
 */

import { generateUPIUrl, triggerUPIPayment, formatUPIClipboardText } from '../lib/upiIntent';
import * as Linking from 'expo-linking';

jest.mock('expo-linking');

const mockLinking = Linking as unknown as { canOpenURL: jest.Mock; openURL: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockLinking.canOpenURL.mockResolvedValue(true);
  mockLinking.openURL.mockResolvedValue(undefined);
});

describe('generateUPIUrl', () => {
  it('generates correct UPI deep-link for standard input', () => {
    const url = generateUPIUrl({
      payeeAddress: 'rahul@okhdfcbank',
      payeeName: 'Rahul Sharma',
      amount: 650,
    });

    expect(url).toBe(
      'upi://pay?pa=rahul@okhdfcbank&pn=Rahul%20Sharma&am=650.00&cu=INR&tn=Trip%20Settlement'
    );
  });

  it('formats amount to exactly 2 decimal places', () => {
    const url1 = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 650,
    });
    expect(url1).toContain('am=650.00');

    const url2 = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 650.3,
    });
    expect(url2).toContain('am=650.30');

    const url3 = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 650.333,
    });
    expect(url3).toContain('am=650.33');

    // No trailing zeros beyond 2 decimals
    const url4 = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 1000,
    });
    expect(url4).toContain('am=1000.00');
  });

  it('URI-encodes special characters in payee name', () => {
    const url = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Ravi & Sons Pvt. Ltd.',
      amount: 100,
    });

    expect(url).toContain('pn=Ravi%20%26%20Sons%20Pvt.%20Ltd.');
  });

  it('URI-encodes special characters in note', () => {
    const url = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 100,
      note: 'Goa Trek #1 — Day 3',
    });

    expect(url).toContain('tn=Goa%20Trek%20%231%20%E2%80%94%20Day%203');
  });

  it('uses custom currency when provided', () => {
    const url = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 100,
      currency: 'USD',
    });

    expect(url).toContain('cu=USD');
  });

  it('defaults currency to INR', () => {
    const url = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 100,
    });

    expect(url).toContain('cu=INR');
  });

  it('defaults note to "Trip Settlement" when omitted', () => {
    const url = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 100,
    });

    expect(url).toContain('tn=Trip%20Settlement');
  });

  it('handles zero amount', () => {
    const url = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 0,
    });

    expect(url).toContain('am=0.00');
  });

  it('handles large amounts correctly', () => {
    const url = generateUPIUrl({
      payeeAddress: 'test@upi',
      payeeName: 'Test',
      amount: 999999.99,
    });

    expect(url).toContain('am=999999.99');
  });

  it('VPA address is not double-encoded', () => {
    const url = generateUPIUrl({
      payeeAddress: 'user.name@oksbi',
      payeeName: 'Test',
      amount: 100,
    });

    // VPA should appear as-is, not percent-encoded
    expect(url).toContain('pa=user.name@oksbi');
  });
});

describe('triggerUPIPayment', () => {
  it('opens UPI URL when app is available', async () => {
    mockLinking.canOpenURL.mockResolvedValue(true);

    const result = await triggerUPIPayment({
      payeeAddress: 'rahul@upi',
      payeeName: 'Rahul',
      amount: 650,
    });

    expect(result.success).toBe(true);
    expect(mockLinking.canOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('upi://pay')
    );
    expect(mockLinking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('upi://pay')
    );
  });

  it('returns error when no UPI app is detected', async () => {
    mockLinking.canOpenURL.mockResolvedValue(false);

    const result = await triggerUPIPayment({
      payeeAddress: 'rahul@upi',
      payeeName: 'Rahul',
      amount: 650,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No compatible UPI app');
    expect(mockLinking.openURL).not.toHaveBeenCalled();
  });

  it('handles Linking.openURL failure gracefully', async () => {
    mockLinking.canOpenURL.mockResolvedValue(true);
    mockLinking.openURL.mockRejectedValue(new Error('User cancelled'));

    const result = await triggerUPIPayment({
      payeeAddress: 'rahul@upi',
      payeeName: 'Rahul',
      amount: 650,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('User cancelled');
  });

  it('passes the correct URL to Linking.openURL', async () => {
    await triggerUPIPayment({
      payeeAddress: 'sara@paytm',
      payeeName: 'Sara Khan',
      amount: 420.50,
      note: 'Goa Settlement',
    });

    const calledUrl = mockLinking.openURL.mock.calls[0][0];
    expect(calledUrl).toBe(
      'upi://pay?pa=sara@paytm&pn=Sara%20Khan&am=420.50&cu=INR&tn=Goa%20Settlement'
    );
  });
});

describe('formatUPIClipboardText', () => {
  it('formats standard clipboard text', () => {
    const text = formatUPIClipboardText({
      payeeAddress: 'rahul@upi',
      payeeName: 'Rahul',
      amount: 650,
    });

    expect(text).toContain('UPI: rahul@upi');
    expect(text).toContain('Amount: ₹650.00');
    expect(text).toContain('Note: Trip Settlement');
  });

  it('uses custom note when provided', () => {
    const text = formatUPIClipboardText({
      payeeAddress: 'rahul@upi',
      payeeName: 'Rahul',
      amount: 650,
      note: 'Goa Trek Day 3',
    });

    expect(text).toContain('Note: Goa Trek Day 3');
  });
});
