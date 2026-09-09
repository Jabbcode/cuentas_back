import { vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../types/index.js';

export function fakeReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    user: { userId: 'user-1', email: 'user@test.com' },
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as unknown as AuthRequest;
}

export type FakeResponse = Response & {
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  cookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

export function fakeRes(): FakeResponse {
  const res = {} as FakeResponse;
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

export function fakeNext() {
  return vi.fn();
}
