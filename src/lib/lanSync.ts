import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getTripById, mergeTripFromPayload, getUnsyncedLedgerEvents, markLedgerEventsSynced } from './database';
import { generateUUID } from './uuid';
import type { Trip } from '../types';

const PEERS_KEY = 'moneyvoice_sync_peers';

const SYNC_PORT = 8765;
export const SYNC_POLL_MS = 30_000;
let deviceId = generateUUID();

export interface SyncConfig {
  peerIP: string;
  tripId: string;
}

/**
 * LAN sync: fetch delta from a peer on the same local network.
 * Protocol (JSON over HTTP):
 * POST /sync/delta  -> { deviceId, tripId, lastSyncTimestamp }
 *   Response: { trip, newEvents, syncTimestamp }
 * POST /sync/push   -> { deviceId, trip, events, syncTimestamp }
 *   Response: { ok: true }
 */
export async function fetchDeltaFromPeer(
  config: SyncConfig,
  lastSyncTs: number
): Promise<{ trip: Trip | null; merged: number; newSyncTs: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`http://${config.peerIP}:${SYNC_PORT}/sync/delta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, tripId: config.tripId, lastSyncTimestamp: lastSyncTs }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.trip) {
      const mergeResult = await mergeTripFromPayload(data.trip);
      return {
        trip: data.trip,
        merged: mergeResult.inserted + mergeResult.updated,
        newSyncTs: data.syncTimestamp || Date.now(),
      };
    }

    return { trip: null, merged: 0, newSyncTs: data.syncTimestamp || Date.now() };
  } catch {
    return null;
  }
}

export async function pushToPeer(config: SyncConfig): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const trip = await getTripById(config.tripId);
    if (!trip) return false;

    const events = await getUnsyncedLedgerEvents(config.tripId);

    const res = await fetch(`http://${config.peerIP}:${SYNC_PORT}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, trip, events, syncTimestamp: Date.now() }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const eventIds = events.map((e: any) => e.id);
      if (eventIds.length > 0) await markLedgerEventsSynced(eventIds);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns the LAN IP of the current device (Android only).
 */
export async function getDeviceLANIP(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      const NetInfo = await import('expo-network');
      const state: any = await NetInfo.getNetworkStateAsync();
      if (state?.type === 'wifi' && state?.details?.ipAddress) {
        return state.details.ipAddress;
      }
    }
  } catch {}
  return null;
}

export interface SyncPeer {
  ip: string;
  name?: string;
  lastSeen: number;
}

export async function getRegisteredPeers(): Promise<SyncPeer[]> {
  try {
    const raw = await SecureStore.getItemAsync(PEERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SyncPeer[];
    const now = Date.now();
    return list.filter((p) => now - p.lastSeen < 30 * 60 * 1000);
  } catch {
    return [];
  }
}

export async function registerPeerByIP(ip: string, name?: string): Promise<void> {
  try {
    const peers = await getRegisteredPeers();
    const cleanIP = ip.trim().replace(/^http:\/\//, '');
    const existing = peers.find((p) => p.ip === cleanIP);
    if (existing) {
      existing.lastSeen = Date.now();
      existing.name = name || existing.name;
    } else {
      peers.push({ ip: cleanIP, name, lastSeen: Date.now() });
    }
    await SecureStore.setItemAsync(PEERS_KEY, JSON.stringify(peers));
  } catch {}
}

export { deviceId };
