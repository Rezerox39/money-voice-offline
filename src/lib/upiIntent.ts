// ─────────────────────────────────────────────────────────────────
// upiIntent.ts — Zero-intermediary UPI payment dispatcher
// Uses native Android intent deep-links via expo-linking.
// Launches installed UPI apps (GPay, PhonePe, Paytm, BHIM)
// with recipient VPA and amount pre-filled. No SDK, no gateway.
// ─────────────────────────────────────────────────────────────────

import * as Linking from 'expo-linking';

// ── Types ──────────────────────────────────────────────────────────

export interface UPIPaymentRequest {
  payeeAddress: string;   // e.g. "rahul@okhdfcbank"
  payeeName: string;      // e.g. "Rahul Sharma"
  amount: number;         // e.g. 650.00
  currency?: string;      // default 'INR'
  note?: string;          // e.g. "Goa Trek Settlement"
}

export interface UPIResult {
  success: boolean;
  error?: string;
}

// ── URL Generation ─────────────────────────────────────────────────

/**
 * Generate an RFC-compliant UPI deep-link URI.
 * Amount is always formatted to exactly 2 decimal places.
 * Special characters in names and notes are URI-encoded.
 *
 * Format: upi://pay?pa={vpa}&pn={name}&am={amount}&cu=INR&tn={note}
 */
export function generateUPIUrl(params: UPIPaymentRequest): string {
  const formattedAmount = params.amount.toFixed(2);
  const note = encodeURIComponent(params.note || 'Trip Settlement');
  const name = encodeURIComponent(params.payeeName);
  const currency = params.currency || 'INR';

  return `upi://pay?pa=${params.payeeAddress}&pn=${name}&am=${formattedAmount}&cu=${currency}&tn=${note}`;
}

// ── Payment Trigger ────────────────────────────────────────────────

/**
 * Trigger a UPI payment via native Android intent.
 * Falls back gracefully if no UPI app is installed.
 */
export async function triggerUPIPayment(params: UPIPaymentRequest): Promise<UPIResult> {
  const url = generateUPIUrl(params);

  try {
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      return {
        success: false,
        error: 'No compatible UPI app detected. Copy handle manually.',
      };
    }

    await Linking.openURL(url);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to open UPI app.',
    };
  }
}

/**
 * Copy a UPI handle + amount to clipboard as fallback.
 * Useful when no UPI app is installed.
 */
export function formatUPIClipboardText(params: UPIPaymentRequest): string {
  const formattedAmount = params.amount.toFixed(2);
  const note = params.note || 'Trip Settlement';
  return `UPI: ${params.payeeAddress}\nAmount: ₹${formattedAmount}\nNote: ${note}`;
}
