import { describe, it, expect, afterEach } from 'vitest';
import type { Request } from 'express';
import { fakeRes, fakeNext } from './http-fakes.js';
import { getVersion } from '../version.controller.js';

function fakeVersionReq(): Request {
  return {} as unknown as Request;
}

describe('version.controller.getVersion', () => {
  const originalAppVersion = process.env.APP_VERSION;
  const originalAppEnv = process.env.APP_ENV;

  afterEach(() => {
    process.env.APP_VERSION = originalAppVersion;
    process.env.APP_ENV = originalAppEnv;
  });

  it('con APP_VERSION seteada devuelve esa cadena exacta', async () => {
    process.env.APP_VERSION = '1.5.0-SNAPSHOT';
    const res = fakeRes();

    await getVersion(fakeVersionReq(), res, fakeNext());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ version: '1.5.0-SNAPSHOT' }));
  });

  it('sin APP_VERSION cae a npm_package_version', async () => {
    delete process.env.APP_VERSION;
    process.env.npm_package_version = '1.0.0';
    const res = fakeRes();

    await getVersion(fakeVersionReq(), res, fakeNext());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ version: '1.0.0' }));
  });

  it('el body tiene solo las claves version y environment', async () => {
    process.env.APP_VERSION = '1.4.0';
    process.env.APP_ENV = 'production';
    const res = fakeRes();

    await getVersion(fakeVersionReq(), res, fakeNext());

    const body = res.json.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(['environment', 'version']);
  });
});
