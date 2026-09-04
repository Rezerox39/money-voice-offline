// ─────────────────────────────────────────────────────────────────
// LedgerContext.tsx — Dual-mode state engine: /PERSONAL ↔ /TRIP
// Manages active mode, trip selection, and data refresh.
// ─────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Trip, PersonalExpense } from '../types';
import {
  getAllTrips,
  getTripById,
  getPersonalExpenses,
} from '../lib/database';

// ── Types ──────────────────────────────────────────────────────────

export type ActiveMode = 'PERSONAL' | 'TRIP';

export interface LedgerContextValue {
  mode: ActiveMode;
  setMode: (mode: ActiveMode) => void;
  activeTripId: string | null;
  setActiveTripId: (id: string | null) => void;
  activeTrip: Trip | null;
  personalExpenses: PersonalExpense[];
  allTrips: Trip[];
  refreshActiveData: () => Promise<void>;
  refreshTrips: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within LedgerProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ActiveMode>('PERSONAL');
  const [activeTripId, setActiveTripIdState] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [personalExpenses, setPersonalExpenses] = useState<PersonalExpense[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);

  const refreshTrips = useCallback(async () => {
    const trips = await getAllTrips();
    setAllTrips(trips);
  }, []);

  const refreshActiveData = useCallback(async () => {
    if (mode === 'PERSONAL') {
      const expenses = await getPersonalExpenses();
      setPersonalExpenses(expenses);
    } else if (activeTripId) {
      const trip = await getTripById(activeTripId);
      setActiveTrip(trip);
    }
  }, [mode, activeTripId]);

  // Load trips on mount
  useEffect(() => {
    refreshTrips();
  }, [refreshTrips]);

  // Refresh data when mode or active trip changes
  useEffect(() => {
    refreshActiveData();
  }, [refreshActiveData]);

  // Auto-select first trip if none selected and trips exist
  useEffect(() => {
    if (mode === 'TRIP' && !activeTripId && allTrips.length > 0) {
      setActiveTripIdState(allTrips[0].id);
    }
  }, [mode, activeTripId, allTrips]);

  const setActiveTripId = useCallback((id: string | null) => {
    setActiveTripIdState(id);
    if (id) setMode('TRIP');
  }, []);

  const value: LedgerContextValue = {
    mode,
    setMode,
    activeTripId,
    setActiveTripId,
    activeTrip,
    personalExpenses,
    allTrips,
    refreshActiveData,
    refreshTrips,
  };

  return (
    <LedgerContext.Provider value={value}>
      {children}
    </LedgerContext.Provider>
  );
}
