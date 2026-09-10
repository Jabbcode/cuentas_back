import { describe, it, expect } from 'vitest';
import { isOriginAllowed, VERCEL_PREVIEW_ORIGIN_PATTERN } from '../cors-origin.js';

const EXACT_ORIGIN = 'https://cuentas-front-amber.vercel.app';
const PREVIEW_ALIAS = 'https://cuentas-front-git-feature-x-jabbcodes-projects.vercel.app';

describe('isOriginAllowed', () => {
  describe('lista exacta de CORS_ORIGIN', () => {
    it('acepta el origen exacto configurado en CORS_ORIGIN', () => {
      const allowed = isOriginAllowed(EXACT_ORIGIN, {
        corsOrigin: EXACT_ORIGIN,
        appEnv: 'production',
      });

      expect(allowed).toBe(true);
    });

    it('acepta cualquiera de los orígenes de una lista separada por comas', () => {
      const corsOrigin = `${EXACT_ORIGIN}, https://otra.app`;

      expect(isOriginAllowed('https://otra.app', { corsOrigin, appEnv: 'production' })).toBe(true);
      expect(isOriginAllowed(EXACT_ORIGIN, { corsOrigin, appEnv: 'production' })).toBe(true);
    });

    it('permite una petición sin cabecera Origin (no es CORS de navegador)', () => {
      const allowed = isOriginAllowed(undefined, {
        corsOrigin: EXACT_ORIGIN,
        appEnv: 'production',
      });

      expect(allowed).toBe(true);
    });

    it('rechaza un origen que no está en la lista', () => {
      const allowed = isOriginAllowed('https://intruso.app', {
        corsOrigin: EXACT_ORIGIN,
        appEnv: 'production',
      });

      expect(allowed).toBe(false);
    });
  });

  describe('alias de preview de Vercel (APP_ENV = pre | pre-test)', () => {
    it('acepta un alias que casa con el patrón en el slot pre', () => {
      const allowed = isOriginAllowed(PREVIEW_ALIAS, {
        corsOrigin: EXACT_ORIGIN,
        appEnv: 'pre',
      });

      expect(allowed).toBe(true);
    });

    it('acepta un alias que casa con el patrón en el slot pre-test', () => {
      const allowed = isOriginAllowed(PREVIEW_ALIAS, {
        corsOrigin: EXACT_ORIGIN,
        appEnv: 'pre-test',
      });

      expect(allowed).toBe(true);
    });

    it('rechaza un alias de otra cuenta de Vercel', () => {
      const origin = 'https://cuentas-front-git-x-otracuenta.vercel.app';

      expect(isOriginAllowed(origin, { corsOrigin: EXACT_ORIGIN, appEnv: 'pre' })).toBe(false);
    });

    it('rechaza un sufijo que extiende el dominio esperado', () => {
      const origin = 'https://cuentas-front-git-x-jabbcodes-projects.vercel.app.evil.com';

      expect(isOriginAllowed(origin, { corsOrigin: EXACT_ORIGIN, appEnv: 'pre' })).toBe(false);
    });

    it('rechaza el mismo alias servido sin TLS (http)', () => {
      const origin = 'http://cuentas-front-git-x-jabbcodes-projects.vercel.app';

      expect(isOriginAllowed(origin, { corsOrigin: EXACT_ORIGIN, appEnv: 'pre' })).toBe(false);
    });
  });

  describe('producción nunca activa la regex de preview', () => {
    const casosDenegados = [
      PREVIEW_ALIAS,
      'https://cuentas-front-git-x-otracuenta.vercel.app',
      'https://cuentas-front-git-x-jabbcodes-projects.vercel.app.evil.com',
      'http://cuentas-front-git-x-jabbcodes-projects.vercel.app',
    ];

    for (const origin of casosDenegados) {
      it(`rechaza ${origin} con APP_ENV=production`, () => {
        const allowed = isOriginAllowed(origin, {
          corsOrigin: EXACT_ORIGIN,
          appEnv: 'production',
        });

        expect(allowed).toBe(false);
      });
    }

    it('tampoco la activa un APP_ENV ausente', () => {
      const allowed = isOriginAllowed(PREVIEW_ALIAS, {
        corsOrigin: EXACT_ORIGIN,
        appEnv: undefined,
      });

      expect(allowed).toBe(false);
    });
  });

  it('el patrón exportado está anclado (no acepta path ni sufijo extra)', () => {
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.test(PREVIEW_ALIAS)).toBe(true);
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.test(`${PREVIEW_ALIAS}/path`)).toBe(false);
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.test(`${PREVIEW_ALIAS}.evil.com`)).toBe(false);
  });
});
