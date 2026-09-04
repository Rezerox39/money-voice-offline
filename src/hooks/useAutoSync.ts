import { useEffect, useRef, useState, useCallback } from 'react';

import { fetchDeltaFromPeer, pushToPeer, SYNC_POLL_MS, getRegisteredPeers, registerPeerByIP } from '../lib/lanSync';
import * as Haptics from 'expo-haptics';
import type { SyncConfig, SyncPeer } from '../lib/lanSync';
import * as SecureStore from 'expo-secure-store';

const PEERS_KEY = 'moneyvoice_sync_peers';
const LAST_SYNC_KEY = 'moneyvoice_last_sync_ts';

async function getStored(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}
async function storeValue(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value); } catch {}
}

export interface AutoSyncResult {
  lastSyncAt: number | null;
  lastMessage: string | null;
  healthy: boolean;
  isSyncing: boolean;
}

export function useAutoSync(tripId: string | null) {
  const [peers, setPeers] = useState<SyncPeer[]>([]);
  const [result, setResult] = useState<AutoSyncResult>({
    lastSyncAt: null,
    lastMessage: null,
    healthy: true,
    isSyncing: false,
  });
  const tripIdRef = useRef(tripId);
  tripIdRef.current = tripId;
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPeers = useCallback(async (): Promise<SyncPeer[]> => {
    try {
      const fresh = await getRegisteredPeers();
      setPeers(fresh);
      return fresh;
    } catch {
      return [];
    }
  }, []);

  const mergePeer = useCallback(
    async (ip: string, name?: string) => {
      await registerPeerByIP(ip, name);
      await loadPeers();
    },
    [loadPeers]
  );

  // Discover local peers via broadcast UDP datagram (best effort)
  const discoverPeers = useCallback(async (): Promise<SyncPeer[]> => {
    const list = await loadPeers();
    return list;
  }, [loadPeers]);

  const runSyncCycle = useCallback(async () => {
    const tripIdNow = tripIdRef.current;
    if (!tripIdNow) {
      setResult((r) => ({ ...r, healthy: true, lastMessage: 'No active trip' }));
      return;
    }

    setResult((r) => ({ ...r, isSyncing: true }));

    try {
      const peers = await discoverPeers();
      if (peers.length === 0) {
        setResult((r) => ({ ...r, isSyncing: false, healthy: true, lastMessage: 'No peers on mesh' }));
        return;
      }

      let lastSyncTs = 0;
      try {
        const raw = await getStored(LAST_SYNC_KEY);
        if (raw) lastSyncTs = parseInt(raw, 10) || 0;
      } catch {}

      let totalMerged = 0;
      let pushed = false;
      for (const peer of peers) {
        const config: SyncConfig = { peerIP: peer.ip, tripId: tripIdNow };
        const delta = await fetchDeltaFromPeer(config, lastSyncTs);
        if (delta) {
          totalMerged += delta.merged;
          lastSyncTs = Math.max(lastSyncTs, delta.newSyncTs);
        }
        const ok = await pushToPeer(config);
        if (ok) pushed = true;
      }

      if (lastSyncTs > 0) {
        try {
          await storeValue(LAST_SYNC_KEY, String(lastSyncTs));
        } catch {}
      }

      const now = Date.now();
      setResult({
        lastSyncAt: now,
        lastMessage: totalMerged > 0 ? `Synced: ${totalMerged} new/updated entries` : 'All devices in sync',
        healthy: true,
        isSyncing: false,
      });

      if (totalMerged > 0) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (err) {
      setResult((r) => ({
        ...r,
        isSyncing: false,
        healthy: false,
        lastMessage: 'Sync unavailable (offline or no peers)',
      }));
    }
  }, [discoverPeers]);

  // Start/stop periodic polling (every 30s) when a trip is active
  useEffect(() => {
    if (!tripId) return;

    runSyncCycle();
    pollingRef.current = setInterval(runSyncCycle, SYNC_POLL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tripId, runSyncCycle]);

  // Merge peer (public helper to register a peer from QR join or manual entry)
  const registerPeer = useCallback(
    async (ip: string, name?: string) => {
      await mergePeer(ip, name);
      await runSyncCycle();
    },
    [mergePeer, runSyncCycle]
  );

  return {
    peers,
    registerPeer,
    syncNow: runSyncCycle,
    ...result,
  };
}
