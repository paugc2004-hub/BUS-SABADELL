import { useMemo } from 'react';
import { useApp } from '../state/store.ts';
import { DemoWallet } from './wallet.ts';

function storage() {
  try {
    const k = '__nm_wallet_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

const cache = new Map<string, DemoWallet>();

/** El moneder de demostració del compte actual (cada compte el seu: `wallet:<userId>`). */
export function walletFor(userId: string): DemoWallet {
  let w = cache.get(userId);
  if (!w) {
    w = new DemoWallet(storage(), userId);
    cache.set(userId, w);
  }
  return w;
}

/** Moneder + una versió que canvia quan s'hi escriu (per tornar a pintar). */
export function useWallet(): { wallet: DemoWallet; version: number; changed: () => void } {
  const userId = useApp((s) => s.user?.id ?? 'demo');
  const version = useApp((s) => s.walletVersion);
  const wallet = useMemo(() => walletFor(userId), [userId]);
  return { wallet, version, changed: () => useApp.getState().bumpWallet() };
}
