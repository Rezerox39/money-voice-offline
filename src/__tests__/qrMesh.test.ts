import {
  encodeTripMesh,
  serializeFrame,
  parseFrame,
  hashPayload,
  decompressPayload,
} from '../lib/qrMesh';
import { QRAccumulator } from '../lib/qrAccumulator';

describe('hashPayload', () => {
  it('produces consistent hashes', () => {
    const h1 = hashPayload('hello world');
    const h2 = hashPayload('hello world');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('different inputs produce different hashes', () => {
    const h1 = hashPayload('hello');
    const h2 = hashPayload('world');
    expect(h1).not.toBe(h2);
  });
});

describe('encodeTripMesh — single frame', () => {
  it('generates single frame for small payload', () => {
    const payload = JSON.stringify({
      version: 1,
      trip: { id: 't1', name: 'Goa', members: [], expenses: [], createdAt: 0, updatedAt: 0 },
      exportedAt: Date.now(),
    });

    const result = encodeTripMesh(payload);
    expect(result.isSingleFrame).toBe(true);
    expect(result.frames.length).toBe(1);
    expect(result.frames[0].seq).toBe(0);
    expect(result.frames[0].total).toBe(1);
  });

  it('single frame round-trips correctly', () => {
    const payload = JSON.stringify({ version: 1, trip: { id: 't1', name: 'Goa' } });
    const result = encodeTripMesh(payload);

    // Parse the frame
    const wire = serializeFrame(result.frames[0]);
    const parsed = parseFrame(wire);
    expect(parsed).not.toBeNull();
    expect(parsed!.data).toBe(result.frames[0].data);

    // Decompress
    const decompressed = decompressPayload(parsed!.data);
    expect(decompressed).toBe(payload);
  });
});

describe('encodeTripMesh — multi-frame', () => {
  function makeLargeTripPayload(memberCount: number, expenseCount: number): string {
    const members = Array.from({ length: memberCount }, (_, i) => ({
      id: `m${i}`,
      name: `Member ${i}`,
      upiOrHandle: `user${i}@upi`,
    }));
    const expenses = Array.from({ length: expenseCount }, (_, i) => ({
      id: `e${i}`,
      tripId: 't1',
      title: `Expense ${i} for various items and services`,
      amount: Math.round(Math.random() * 10000) / 100,
      paidBy: `m${i % memberCount}`,
      splitBetween: members.slice(0, 3).map((m) => ({
        memberId: m.id,
        amount: Math.round(Math.random() * 100) / 100,
      })),
      category: 'Food',
      updatedAt: Date.now(),
    }));

    return JSON.stringify({
      version: 1,
      trip: {
        id: 't1',
        name: 'Ladakh Adventure Trip',
        currency: 'INR',
        members,
        expenses,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      exportedAt: Date.now(),
    });
  }

  it('generates multiple frames for large payload (> 1200 bytes)', () => {
    const payload = makeLargeTripPayload(10, 50);
    const result = encodeTripMesh(payload);

    expect(result.isSingleFrame).toBe(false);
    expect(result.frames.length).toBeGreaterThan(1);
    expect(result.totalPayloadBytes).toBeGreaterThan(1200);

    // All frames share the same hash and total count
    const hash = result.frames[0].hash;
    const total = result.frames[0].total;
    result.frames.forEach((f) => {
      expect(f.hash).toBe(hash);
      expect(f.total).toBe(total);
    });
  });

  it('reassembles multi-frame payload with checksum match', () => {
    const payload = makeLargeTripPayload(15, 80);
    const result = encodeTripMesh(payload);

    // Serialize all frames and reassemble
    const wires = result.frames.map(serializeFrame);
    const compressedChunks = wires.map((w) => {
      const parsed = parseFrame(w);
      return parsed!.data;
    });

    // All chunks concatenated → decompress
    const fullCompressed = compressedChunks.join('');
    const decompressed = decompressPayload(fullCompressed);
    expect(decompressed).toBe(payload);

    // Hash verification
    const hash = hashPayload(fullCompressed);
    expect(hash).toBe(result.frames[0].hash);
  });

  it('handles very large payloads (100+ expenses)', () => {
    const payload = makeLargeTripPayload(20, 150);
    const result = encodeTripMesh(payload);

    expect(result.frames.length).toBeGreaterThan(2);

    // Verify each frame is within size limits
    for (const frame of result.frames) {
      const wire = serializeFrame(frame);
      // Wire format should be reasonable (under 2KB for camera readability)
      expect(new Blob([wire]).size).toBeLessThan(2048);
    }

    // Full reassembly
    const compressedChunks = result.frames.map((f) => f.data);
    const fullCompressed = compressedChunks.join('');
    const decompressed = decompressPayload(fullCompressed);
    expect(decompressed).toBe(payload);
  });
});

describe('parseFrame', () => {
  it('parses valid frame string', () => {
    const frame = { seq: 0, total: 3, hash: 'a8f3b2c1', data: 'eJzL' };
    const wire = serializeFrame(frame);
    const parsed = parseFrame(wire);
    expect(parsed).toEqual(frame);
  });

  it('returns null for non-frame strings', () => {
    expect(parseFrame('hello world')).toBeNull();
    expect(parseFrame('TRIP:compresseddata')).toBeNull();
    expect(parseFrame('')).toBeNull();
  });

  it('returns null for malformed frames', () => {
    expect(parseFrame('FRAME:abc:3:hash:data')).toBeNull(); // seq not a number
    expect(parseFrame('FRAME:0:3:short:data')).toBeNull();  // hash too short
    expect(parseFrame('FRAME:0:3:a8f3b2c1')).toBeNull();   // missing data separator
  });

  it('returns null for out-of-range seq', () => {
    expect(parseFrame('FRAME:5:3:a8f3b2c1:data')).toBeNull(); // seq >= total
  });
});

describe('QRAccumulator', () => {
  it('tracks partial progress', () => {
    const acc = new QRAccumulator();
    const payload = JSON.stringify({ version: 1, trip: { id: 't1', name: 'Test' } });
    const mesh = encodeTripMesh(payload);

    // If single frame, create a fake multi-frame scenario
    const frame1 = { seq: 0, total: 3, hash: 'aabbccdd', data: 'chunk1' };
    const frame2 = { seq: 1, total: 3, hash: 'aabbccdd', data: 'chunk2' };

    const r1 = acc.feed(serializeFrame(frame1));
    expect(r1.status).toBe('partial');
    expect(r1.progress.receivedCount).toBe(1);
    expect(r1.progress.totalFrames).toBe(3);
    expect(r1.progress.percent).toBe(33);

    const r2 = acc.feed(serializeFrame(frame2));
    expect(r2.status).toBe('partial');
    expect(r2.progress.receivedCount).toBe(2);
    expect(r2.progress.percent).toBe(67);
  });

  it('assembles payload when all frames received', () => {
    const acc = new QRAccumulator();

    // Create a payload that will be compressed and chunked
    const originalPayload = JSON.stringify({
      version: 1,
      trip: { id: 't1', name: 'Goa Trip', members: [], expenses: [] },
      exportedAt: 12345,
    });

    const mesh = encodeTripMesh(originalPayload);
    expect(mesh.frames.length).toBeGreaterThan(0);

    let lastResult;
    for (const frame of mesh.frames) {
      lastResult = acc.feed(serializeFrame(frame));
    }

    expect(lastResult!.status).toBe('complete');
    expect(lastResult!.payload).toBe(originalPayload);
    expect(acc.isComplete).toBe(true);
  });

  it('rejects frames with mismatched checksums', () => {
    const acc = new QRAccumulator();
    const frame1 = { seq: 0, total: 2, hash: 'aabbccdd', data: 'chunk1' };
    const frame2 = { seq: 1, total: 2, hash: '11223344', data: 'chunk2' }; // different hash

    acc.feed(serializeFrame(frame1));
    const r2 = acc.feed(serializeFrame(frame2));
    expect(r2.status).toBe('error');
    expect(r2.error).toContain('Checksum mismatch');
  });

  it('rejects invalid frame format', () => {
    const acc = new QRAccumulator();
    const r = acc.feed('not a frame at all');
    expect(r.status).toBe('error');
    expect(r.error).toContain('Invalid frame');
  });

  it('resets cleanly', () => {
    const acc = new QRAccumulator();
    const frame = { seq: 0, total: 3, hash: 'aabbccdd', data: 'chunk1' };
    acc.feed(serializeFrame(frame));
    expect(acc.getProgress().receivedCount).toBe(1);

    acc.reset();
    expect(acc.getProgress().receivedCount).toBe(0);
    expect(acc.isComplete).toBe(false);
  });

  it('redundant duplicate frames are idempotent', () => {
    const acc = new QRAccumulator();
    const frame = { seq: 0, total: 3, hash: 'aabbccdd', data: 'chunk1' };
    const wire = serializeFrame(frame);

    acc.feed(wire);
    acc.feed(wire); // duplicate
    expect(acc.getProgress().receivedCount).toBe(1); // still 1, not 2
  });
});
