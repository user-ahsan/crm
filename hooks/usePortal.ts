'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PortalUser, PortalUserFormData, PortalShare, PortalShareFormData } from '@/types/portal.types';
import { portalService } from '@/services/portal.service';

export function usePortalUsers() {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await portalService.getUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load portal users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await portalService.getUsers();
        if (!cancelled) setUsers(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load portal users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const createUser = async (data: PortalUserFormData) => {
    const user = await portalService.createUser(data);
    setUsers((prev) => [user, ...prev]);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await portalService.toggleUserActive(id, active);
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, active } : u)),
    );
  };

  const deleteUser = async (id: string) => {
    await portalService.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return { users, loading, error, reload: load, createUser, toggleActive, deleteUser };
}

export function usePortalShares(portalUserId: string | null) {
  const [shares, setShares] = useState<PortalShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!portalUserId) {
      setShares([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await portalService.getShares(portalUserId);
      setShares(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, [portalUserId]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!portalUserId) {
      setShares([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await portalService.getShares(portalUserId);
        if (!cancelled) setShares(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load shares');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [portalUserId]);

  const shareRecord = async (data: PortalShareFormData) => {
    const share = await portalService.shareRecord(data);
    setShares((prev) => [share, ...prev]);
  };

  const removeShare = async (id: string) => {
    await portalService.removeShare(id);
    setShares((prev) => prev.filter((s) => s.id !== id));
  };

  return { shares, loading, error, reload: load, shareRecord, removeShare };
}
