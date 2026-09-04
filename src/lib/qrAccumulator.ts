// ─────────────────────────────────────────────────────────────────
// qrAccumulator.ts — State machine for multi-frame QR scanning
// Tracks received chunks, verifies checksum, and reassembles payload.
// ─────────────────────────────────────────────────────────────────

import { parseFrame, hashPayload, decompressPayload, type QRFrame } from './qrMesh';

export interface AccumulatorProgress {
  receivedCount: number;
  totalFrames: number;
  percent: number;
  hash: string | null;
  bar: string; // ASCII progress bar
}

export interface AccumulatorResult {
  status: 'partial' | 'complete' | 'error';
  progress: AccumulatorProgress;
  payload: string | null; // Decompressed JSON string when complete
  error?: string;
}

export class QRAccumulator {
  private receivedFrames: Map<number, QRFrame> = new Map();
  private expectedTotal: number = 0;
  private expectedHash: string | null = null;
  private _complete = false;

  /**
   * Feed a raw QR scan string into the accumulator.
   * Returns the current state after processing.
   */
  feed(rawScan: string): AccumulatorResult {
    const frame = parseFrame(rawScan);

    if (!frame) {
      return {
        status: 'error',
        progress: this.getProgress(),
        payload: null,
        error: 'Invalid frame format',
      };
    }

    // First frame sets expectations
    if (this.expectedTotal === 0) {
      this.expectedTotal = frame.total;
      this.expectedHash = frame.hash;
    } else if (frame.hash !== this.expectedHash) {
      return {
        status: 'error',
        progress: this.getProgress(),
        payload: null,
        error: `Checksum mismatch: expected ${this.expectedHash}, got ${frame.hash}`,
      };
    } else if (frame.total !== this.expectedTotal) {
      return {
        status: 'error',
        progress: this.getProgress(),
        payload: null,
        error: `Total frame count mismatch: expected ${this.expectedTotal}, got ${frame.total}`,
      };
    }

    this.receivedFrames.set(frame.seq, frame);

    const progress = this.getProgress();

    // Check if all frames received
    if (this.receivedFrames.size === this.expectedTotal) {
      // Verify integrity hash against compressed data
      const compressed = this.assembleCompressed();
      const actualHash = hashPayload(compressed);
      if (actualHash !== this.expectedHash) {
        return {
          status: 'error',
          progress,
          payload: null,
          error: `Payload integrity check failed`,
        };
      }

      const decompressed = decompressPayload(compressed);
      if (!decompressed) {
        return {
          status: 'error',
          progress,
          payload: null,
          error: 'Failed to decompress assembled payload',
        };
      }

      this._complete = true;
      return { status: 'complete', progress, payload: decompressed };
    }

    return { status: 'partial', progress, payload: null };
  }

  /**
   * Reset the accumulator for a new scan session.
   */
  reset(): void {
    this.receivedFrames.clear();
    this.expectedTotal = 0;
    this.expectedHash = null;
    this._complete = false;
  }

  get isComplete(): boolean {
    return this._complete;
  }

  getProgress(): AccumulatorProgress {
    const receivedCount = this.receivedFrames.size;
    const totalFrames = this.expectedTotal || 0;
    const percent = totalFrames > 0
      ? Math.round((receivedCount / totalFrames) * 100)
      : 0;

    const filled = totalFrames > 0
      ? Math.round((receivedCount / totalFrames) * 20)
      : 0;
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

    return {
      receivedCount,
      totalFrames,
      percent,
      hash: this.expectedHash,
      bar,
    };
  }

  private assembleCompressed(): string {
    const sorted = Array.from(this.receivedFrames.values())
      .sort((a, b) => a.seq - b.seq);
    return sorted.map((f) => f.data).join('');
  }
}
