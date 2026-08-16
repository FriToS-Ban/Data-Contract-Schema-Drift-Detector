import type { Contract, DriftReport, Stats } from '../types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Contracts ────────────────────────────────────────────────────────────────
export const api = {
  contracts: {
    list: () => request<Contract[]>('/contracts'),
    get: (id: string) => request<Contract>(`/contracts/${id}`),
    create: (data: Partial<Contract>) =>
      request<Contract>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Contract>) =>
      request<Contract>(`/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ deleted: boolean }>(`/contracts/${id}`, { method: 'DELETE' }),
    history: (id: string) => request<DriftReport[]>(`/contracts/${id}/history`),
  },

  checks: {
    run: (contractId: string, payload: unknown) =>
      request<{ valid: boolean; driftReport: DriftReport; durationMs: number }>(
        `/checks/${contractId}`,
        { method: 'POST', body: JSON.stringify({ payload }) },
      ),
    infer: (payloads: unknown[]) =>
      request<{ schema: unknown }>('/checks/infer', {
        method: 'POST',
        body: JSON.stringify({ payloads }),
      }),
  },

  history: {
    list: (opts?: { limit?: number; offset?: number; drifted?: boolean }) => {
      const params = new URLSearchParams();
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.offset) params.set('offset', String(opts.offset));
      if (opts?.drifted) params.set('drifted', 'true');
      return request<{ total: number; items: DriftReport[] }>(`/history?${params}`);
    },
    get: (id: string) => request<DriftReport>(`/history/${id}`),
  },

  stats: {
    get: () => request<Stats>('/stats'),
  },
};
