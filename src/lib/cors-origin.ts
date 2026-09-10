/**
 * Resolución del origen permitido para CORS.
 *
 * Fuentes de verdad, en orden:
 *  1. `CORS_ORIGIN`: lista exacta de orígenes separada por comas. Activa siempre.
 *  2. Alias de preview de Vercel (regex anclada): activo SOLO en los slots de
 *     snapshot (`APP_ENV` ∈ {pre, pre-test}). En producción, jamás.
 *
 * La API usa cookie de sesión httpOnly y `cors()` va con `credentials: true`, así
 * que un comodín tipo `*.vercel.app` sería un agujero (cualquier deploy de
 * cualquier cuenta podría lanzar peticiones autenticadas). De ahí la regex
 * anclada, con los puntos escapados y el sufijo de cuenta completo.
 */

/** Valores de `APP_ENV` de los slots que aceptan el alias de preview de Vercel. */
export const PREVIEW_APP_ENVS = ['pre', 'pre-test'] as const;

/**
 * Patrón del alias de preview de Vercel para este proyecto: prefijo fijo
 * `cuentas-front-git-`, slug de rama, y sufijo de cuenta completo. Anclado
 * (`^…$`), puntos escapados, sólo `https`.
 *
 * TODO(F1): confirmar formato exacto del alias de preview de Vercel
 */
export const VERCEL_PREVIEW_ORIGIN_PATTERN =
  /^https:\/\/cuentas-front-git-[a-z0-9-]+-jabbcodes-projects\.vercel\.app$/;

export interface CorsOriginOptions {
  /** Valor crudo de `CORS_ORIGIN` (uno o varios orígenes separados por comas). */
  corsOrigin: string | undefined;
  /** Valor crudo de `APP_ENV`. */
  appEnv: string | undefined;
}

function parseAllowList(corsOrigin: string | undefined): string[] {
  if (!corsOrigin) return [];
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isPreviewEnv(appEnv: string | undefined): boolean {
  return appEnv !== undefined && (PREVIEW_APP_ENVS as readonly string[]).includes(appEnv);
}

/**
 * Función pura: decide si `origin` puede hablar con esta API dada la config de
 * entorno. No lee `process.env` — todo entra por parámetro, así es testeable.
 */
export function isOriginAllowed(
  origin: string | undefined,
  { corsOrigin, appEnv }: CorsOriginOptions
): boolean {
  // Peticiones sin cabecera Origin (health checks, server-to-server, curl): no
  // son CORS de navegador, no hay riesgo con `credentials: true`.
  if (!origin) return true;

  if (parseAllowList(corsOrigin).includes(origin)) return true;

  if (isPreviewEnv(appEnv) && VERCEL_PREVIEW_ORIGIN_PATTERN.test(origin)) return true;

  return false;
}

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Adaptador para `cors({ origin })`: lee `CORS_ORIGIN` y `APP_ENV` de
 * `process.env` en cada petición (mismo patrón de env vars que el resto del
 * repo) y delega la decisión en `isOriginAllowed`.
 */
export function corsOrigin(origin: string | undefined, callback: OriginCallback): void {
  const allowed = isOriginAllowed(origin, {
    corsOrigin: process.env.CORS_ORIGIN,
    appEnv: process.env.APP_ENV,
  });
  callback(null, allowed);
}
