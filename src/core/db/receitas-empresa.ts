import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ReceitaMensal = {
  mes: number;
  ano: number;
  receitaCents: number;
  /** false = mês sem registro (tratado como zero nos cálculos). */
  registrada: boolean;
};

// ─── Helpers de competência ───────────────────────────────────────────────────

function chave(mes: number, ano: number): string {
  return `${ano}-${mes}`;
}

/** Lista as `n` competências que terminam em (mes, ano), da mais antiga à mais recente. */
export function ultimasCompetencias(
  mes: number,
  ano: number,
  n: number
): { mes: number; ano: number }[] {
  const lista: { mes: number; ano: number }[] = [];
  let m = mes;
  let a = ano;
  for (let i = 0; i < n; i++) {
    lista.unshift({ mes: m, ano: a });
    m -= 1;
    if (m === 0) {
      m = 12;
      a -= 1;
    }
  }
  return lista;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Receitas das `n` competências que terminam em (mesFinal, anoFinal), com
 * zeros para meses sem registro — pronto para RBT12 e bases do Presumido.
 */
export async function listarReceitas(
  empresaId: string,
  mesFinal: number,
  anoFinal: number,
  n: number
): Promise<ReceitaMensal[]> {
  const sqlite = await getSqlite();
  const competencias = ultimasCompetencias(mesFinal, anoFinal, n);
  const inicio = competencias[0];
  const rows = await sqlite.select<
    { mes: number; ano: number; receita_cents: number }[]
  >(
    `SELECT mes, ano, receita_cents FROM empresa_receitas
      WHERE empresa_id = ? AND (ano > ? OR (ano = ? AND mes >= ?))`,
    [empresaId, inicio.ano, inicio.ano, inicio.mes]
  );
  const mapa = new Map(rows.map((r) => [chave(r.mes, r.ano), r.receita_cents]));
  return competencias.map((c) => {
    const valor = mapa.get(chave(c.mes, c.ano));
    return {
      mes: c.mes,
      ano: c.ano,
      receitaCents: valor ?? 0,
      registrada: valor !== undefined,
    };
  });
}

/** Grava (ou substitui) a receita de uma competência. */
export async function salvarReceita(
  empresaId: string,
  mes: number,
  ano: number,
  receitaCents: number
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO empresa_receitas (id, empresa_id, mes, ano, receita_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(empresa_id, mes, ano)
     DO UPDATE SET receita_cents = excluded.receita_cents, updated_at = excluded.updated_at`,
    [crypto.randomUUID(), empresaId, mes, ano, receitaCents, ts, ts]
  );
}
