import type { PrismaClient } from '@prisma/client';

/**
 * Construye un PrismaClient fake exponiendo solo los modelos indicados.
 * `models` mapea nombre de modelo -> métodos default (normalmente `vi.fn()`
 * con un resolved value razonable); `overrides` (mismo shape, parcial) se
 * mergea por modelo — permite a cada test de repositorio pisar solo el
 * método que le interesa sin perder los defaults del resto.
 */
export function fakePrismaModels(
  models: Record<string, Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): PrismaClient {
  const result: Record<string, unknown> = {};
  for (const [name, defaults] of Object.entries(models)) {
    result[name] = { ...defaults, ...(overrides[name] as object) };
  }
  return result as unknown as PrismaClient;
}
