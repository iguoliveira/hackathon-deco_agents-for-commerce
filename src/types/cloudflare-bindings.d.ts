/**
 * Tipos dos bindings Cloudflare usados pelo site.
 *
 * Por que não usar o `worker-configuration.d.ts` gerado por `wrangler types`:
 * ele traz as tipagens completas do runtime workerd, que colidem com as
 * definições de `Request` que os pacotes @decocms/* já carregam — incluí-lo no
 * tsconfig quebra o typecheck dentro de node_modules (3 erros em
 * @decocms/blocks e @decocms/tanstack, que shippam TS cru e por isso escapam do
 * `skipLibCheck`). Declarar só a superfície que consumimos mantém o typecheck
 * limpo e o contrato explícito.
 *
 * Ao adicionar um binding novo no wrangler.jsonc, adicione-o aqui também.
 */

declare module "cloudflare:workers" {
  /** Subconjunto de D1Database que este projeto usa. */
  interface D1Result<T> {
    results: T[];
    success: boolean;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<D1Result<never>>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = Record<string, unknown>>(
      statements: D1PreparedStatement[],
    ): Promise<D1Result<T>[]>;
  }

  export const env: {
    /** Catálogo de produtos em SQLite. Local: `.wrangler/state/v3/d1/`. */
    CATALOG_DB: D1Database;
  };
}
