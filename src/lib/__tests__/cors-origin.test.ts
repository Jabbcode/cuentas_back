import { describe, it, expect, afterEach } from 'vitest';
import { isOriginAllowed, corsOrigin } from '../cors-origin.js';

const PROD_ORIGIN = 'https://cuentas-front-amber.vercel.app';
const PRE_ALIAS = 'https://cuentas-front-pre.vercel.app';
const PRE_TEST_ALIAS = 'https://cuentas-front-pre-test.vercel.app';

describe('isOriginAllowed', () => {
  describe('lista exacta de CORS_ORIGIN', () => {
    it('acepta el origen exacto configurado en CORS_ORIGIN', () => {
      expect(isOriginAllowed(PROD_ORIGIN, { corsOrigin: PROD_ORIGIN })).toBe(true);
    });

    it('acepta cualquiera de los orígenes de una lista separada por comas', () => {
      const corsOrigin = `${PROD_ORIGIN}, https://otra.app`;

      expect(isOriginAllowed('https://otra.app', { corsOrigin })).toBe(true);
      expect(isOriginAllowed(PROD_ORIGIN, { corsOrigin })).toBe(true);
    });

    it('tolera espacios alrededor de las comas', () => {
      expect(isOriginAllowed(PRE_ALIAS, { corsOrigin: `  ${PRE_ALIAS}  ,  ${PROD_ORIGIN} ` })).toBe(
        true
      );
    });

    it('acepta el alias fijo del slot pre / pre-test cuando está en CORS_ORIGIN', () => {
      expect(isOriginAllowed(PRE_ALIAS, { corsOrigin: PRE_ALIAS })).toBe(true);
      expect(isOriginAllowed(PRE_TEST_ALIAS, { corsOrigin: PRE_TEST_ALIAS })).toBe(true);
    });

    it('permite una petición sin cabecera Origin (no es CORS de navegador)', () => {
      expect(isOriginAllowed(undefined, { corsOrigin: PROD_ORIGIN })).toBe(true);
    });
  });

  describe('coincidencia estrictamente literal', () => {
    it('rechaza un origen que no está en la lista', () => {
      expect(isOriginAllowed('https://intruso.app', { corsOrigin: PROD_ORIGIN })).toBe(false);
    });

    it('rechaza un sufijo que extiende el dominio permitido', () => {
      expect(isOriginAllowed(`${PRE_ALIAS}.evil.com`, { corsOrigin: PRE_ALIAS })).toBe(false);
    });

    it('rechaza el mismo alias servido sin TLS (http)', () => {
      expect(
        isOriginAllowed('http://cuentas-front-pre.vercel.app', { corsOrigin: PRE_ALIAS })
      ).toBe(false);
    });

    it('rechaza un alias de otra cuenta de Vercel', () => {
      expect(
        isOriginAllowed('https://cuentas-front-pre-otracuenta.vercel.app', {
          corsOrigin: PRE_ALIAS,
        })
      ).toBe(false);
    });

    it('rechaza cualquier origen cuando CORS_ORIGIN no está definido', () => {
      expect(isOriginAllowed(PROD_ORIGIN, { corsOrigin: undefined })).toBe(false);
      expect(isOriginAllowed(PROD_ORIGIN, { corsOrigin: '' })).toBe(false);
    });
  });
});

describe('corsOrigin (adaptador que lee process.env)', () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = originalCorsOrigin;
  });

  it('resuelve el callback a true para un origen de CORS_ORIGIN', () => {
    process.env.CORS_ORIGIN = `${PROD_ORIGIN}, ${PRE_ALIAS}`;

    let result: boolean | undefined;
    corsOrigin(PRE_ALIAS, (err, allow) => {
      expect(err).toBeNull();
      result = allow;
    });

    expect(result).toBe(true);
  });

  it('resuelve el callback a false para un origen ausente de CORS_ORIGIN', () => {
    process.env.CORS_ORIGIN = PROD_ORIGIN;

    let result: boolean | undefined;
    corsOrigin('https://intruso.app', (_err, allow) => {
      result = allow;
    });

    expect(result).toBe(false);
  });

  it('con CORS_ORIGIN sin definir, no permite ningún origen', () => {
    delete process.env.CORS_ORIGIN;

    let result: boolean | undefined;
    corsOrigin(PROD_ORIGIN, (_err, allow) => {
      result = allow;
    });

    expect(result).toBe(false);
  });
});
