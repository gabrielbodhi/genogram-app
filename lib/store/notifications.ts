import { create } from 'zustand';

export interface Notification {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  /** Auto-dismiss after this many ms. Pass 0 to keep it pinned. */
  ttl?: number;
}

interface NotificationsState {
  items: Notification[];
  push: (n: Omit<Notification, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useNotifications = create<NotificationsState>((set) => ({
  items: [],
  push: (n) => {
    const id =
      n.id ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ttl = n.ttl ?? 5000;
    set((s) => ({ items: [...s.items, { ...n, id }] }));
    if (ttl > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
      }, ttl);
    }
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  clear: () => set({ items: [] }),
}));

/**
 * Convenience helpers for use outside React components.
 */
export const notify = {
  info: (message: string, ttl?: number) =>
    useNotifications.getState().push({ level: 'info', message, ttl }),
  success: (message: string, ttl?: number) =>
    useNotifications.getState().push({ level: 'success', message, ttl }),
  warning: (message: string, ttl?: number) =>
    useNotifications.getState().push({ level: 'warning', message, ttl }),
  error: (message: string, ttl?: number) =>
    useNotifications.getState().push({ level: 'error', message, ttl: ttl ?? 0 }),
};
