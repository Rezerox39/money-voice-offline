// ─────────────────────────────────────────────────────────────────
// qrMesh.ts — Animated multi-frame QR chunking engine
// Compresses large payloads and splits them into scannable frames.
// Each frame: FRAME:seq:total:hash:chunk_data
// ─────────────────────────────────────────────────────────────────

import { compressToBase64, decompressFromBase64 } from 'lz-string';

const MAX_SINGLE_FRAME_BYTES = 1200;
const FRAME_PREFIX = 'FRAME:';
const SEPARATOR = ':';

export interface QRFrame {
  seq: number;
  total: number;
  hash: string;
  data: string;
}

export interface QRMeshResult {
  frames: QRFrame[];
  isSingleFrame: boolean;
  totalPayloadBytes: number;
}

/**
 * Simple DJB2-style hash for frame integrity verification.
 * Produces a short hex string (8 chars) from input data.
 */
export function hashPayload(data: string): string {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Encode a trip payload into QR frames.
 * - Payloads <= 1200 bytes: single frame (total_seq: 1)
 * - Payloads > 1200 bytes: split into numbered chunks
 *
 * Format per frame: FRAME:{seq}:{total}:{hash}:{compressed_chunk}
 */
export function encodeTripMesh(payload: string): QRMeshResult {
  const compressed = compressToBase64(payload);
  const totalBytes = new Blob([compressed]).size;

  if (totalBytes <= MAX_SINGLE_FRAME_BYTES) {
    const hash = hashPayload(compressed);
    return {
      frames: [{ seq: 0, total: 1, hash, data: compressed }],
      isSingleFrame: true,
      totalPayloadBytes: totalBytes,
    };
  }

  // Split compressed string into chunks that fit within single-frame limit
  // Each frame header "FRAME:seq:total:hash:" adds ~30 bytes overhead
  const frameOverhead = 40; // conservative estimate
  const chunkSize = MAX_SINGLE_FRAME_BYTES - frameOverhead;

  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += chunkSize) {
    chunks.push(compressed.slice(i, i + chunkSize));
  }

  const hash = hashPayload(compressed);
  const total = chunks.length;

  const frames: QRFrame[] = chunks.map((chunk, seq) => ({
    seq,
    total,
    hash,
    data: chunk,
  }));

  return {
    frames,
    isSingleFrame: false,
    totalPayloadBytes: totalBytes,
  };
}

/**
 * Serialize a QRFrame to its wire format string.
 */
export function serializeFrame(frame: QRFrame): string {
  return `${FRAME_PREFIX}${frame.seq}${SEPARATOR}${frame.total}${SEPARATOR}${frame.hash}${SEPARATOR}${frame.data}`;
}

/**
 * Parse a raw QR scan string back into a QRFrame.
 * Returns null if the string doesn't match the frame format.
 */
export function parseFrame(raw: string): QRFrame | null {
  if (!raw.startsWith(FRAME_PREFIX)) return null;

  const body = raw.slice(FRAME_PREFIX.length);
  const firstSep = body.indexOf(SEPARATOR);
  const secondSep = body.indexOf(SEPARATOR, firstSep + 1);
  const thirdSep = body.indexOf(SEPARATOR, secondSep + 1);

  if (firstSep === -1 || secondSep === -1 || thirdSep === -1) return null;

  const seq = parseInt(body.slice(0, firstSep), 10);
  const total = parseInt(body.slice(firstSep + 1, secondSep), 10);
  const hash = body.slice(secondSep + 1, thirdSep);
  const data = body.slice(thirdSep + 1);

  if (isNaN(seq) || isNaN(total) || seq < 0 || total <= 0 || seq >= total) return null;
  if (!/^[0-9a-f]{8}$/.test(hash)) return null;

  return { seq, total, hash, data };
}

/**
 * Decompress a fully-assembled payload string back to the original JSON.
 */
export function decompressPayload(compressed: string): string | null {
  return decompressFromBase64(compressed);
}
