/**
 * Resolución del origen permitido para CORS.
 *
 * `CORS_ORIGIN` es una lista exacta de orígenes separada por comas. La
 * coincidencia es literal — sin comodines ni regex.
 *
 * La API usa cookie de sesión httpOnly y `cors()` va con `credentials: true`,
 * así que un comodín tipo `*.vercel.app` sería un agujero (cualquier deploy de
 * cualquier cuenta podría lanzar peticiones autenticadas). Los slots de
 * snapshot (`pre`, `pre-test`) tienen una URL de frontend fija por slot
 * (`cuentas-front-pre.vercel.app`, `cuentas-front-pre-test.vercel.app`), así
 * que su origen entra en `CORS_ORIGIN` como cualquier otro — no hace falta
 * patrón dinámico (ver Enmiendas de la spec, hallazgo de F1).
 */

export interface CorsOriginOptions {
  /** Valor crudo de `CORS_ORIGIN` (uno o varios orígenes separados por comas). */
  corsOrigin: string | undefined;
}

function parseAllowList(corsOrigin: string | undefined): string[] {
  if (!corsOrigin) return [];
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Función pura: decide si `origin` puede hablar con esta API dada la config de
 * entorno. No lee `process.env` — todo entra por parámetro, así es testeable.
 */
export function isOriginAllowed(
  origin: string | undefined,
  { corsOrigin }: CorsOriginOptions
): boolean {
  // Peticiones sin cabecera Origin (health checks, server-to-server, curl): no
  // son CORS de navegador, no hay riesgo con `credentials: true`.
  if (!origin) return true;

  return parseAllowList(corsOrigin).includes(origin);
}

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Adaptador para `cors({ origin })`: lee `CORS_ORIGIN` de `process.env` en cada
 * petición (mismo patrón de env vars que el resto del repo) y delega la
 * decisión en `isOriginAllowed`.
 */
export function corsOrigin(origin: string | undefined, callback: OriginCallback): void {
  const allowed = isOriginAllowed(origin, { corsOrigin: process.env.CORS_ORIGIN });
  callback(null, allowed);
}
