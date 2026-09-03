import { compressToBase64, decompressFromBase64 } from 'lz-string';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Trip, TripPayload } from '../types';

const QR_PREFIX = 'TRIP:';
const MAX_QR_BYTES = 1500;

export function encodeTripForQR(trip: Trip): string {
  const payload: TripPayload = {
    version: 1,
    trip,
    exportedAt: Date.now(),
  };

  const json = JSON.stringify(payload);
  const compressed = compressToBase64(json);
  const data = QR_PREFIX + compressed;

  if (new Blob([data]).size > MAX_QR_BYTES * 1.5) {
    throw new Error('PAYLOAD_TOO_LARGE');
  }

  return data;
}

export function decodeTripFromQR(data: string): TripPayload | null {
  if (!data.startsWith(QR_PREFIX)) return null;

  const compressed = data.slice(QR_PREFIX.length);
  const json = decompressFromBase64(compressed);
  if (!json) return null;

  try {
    const payload = JSON.parse(json) as TripPayload;
    if (payload.version !== 1 || !payload.trip) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function exportTripAsFile(trip: Trip): Promise<boolean> {
  const payload: TripPayload = {
    version: 1,
    trip,
    exportedAt: Date.now(),
  };

  const json = JSON.stringify(payload, null, 2);
  const fileName = `moneyvoice-${trip.name.replace(/\s+/g, '_')}-${Date.now()}.json`;
  const file = new File(Paths.document, fileName);
  await file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: `Export ${trip.name}`,
    });
    return true;
  }
  return false;
}

export async function importTripFromFile(
  fileUri: string
): Promise<TripPayload | null> {
  try {
    const file = new File(fileUri);
    const json = await file.text();
    const payload = JSON.parse(json) as TripPayload;
    if (payload.version !== 1 || !payload.trip) return null;
    return payload;
  } catch {
    return null;
  }
}
