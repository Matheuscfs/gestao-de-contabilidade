/**
 * Fluxos de etapas por obrigação — o procedimento do escritório, configurável.
 *
 * A semente vem de `src/consts/fluxos.ts` e é gravada uma única vez (marca em
 * `app_settings`). Depois disso o banco manda: reeditar o arquivo de constantes
 * não sobrescreve o que o usuário ajustou na tela de Fluxos.
 */

import { getSqlite } from "./client";
import { agora } from "@/utils/dates";
import { fluxoPadrao, type CondicaoEtapa } from "@/consts/fluxos";
import { CATALOGO_OBRIGACOES } from "@/consts/obrigacoes";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EtapaFluxo = {
  id: string;
  obrigacaoCodigo: string;
  descricao: string;
  ordem: number;
  condicao: CondicaoEtapa | null;
};

export type DadosEtapaFluxo = {
  descricao: string;
  condicao: CondicaoEtapa | null;
};

type EtapaFluxoRow = {
  id: string;
  obrigacao_codigo: string;
  descricao: string;
  ordem: number;
  condicao: string | null;
};

function mapearLinha(r: EtapaFluxoRow): EtapaFluxo {
  return {
    id: r.id,
    obrigacaoCodigo: r.obrigacao_codigo,
    descricao: r.descricao,
    ordem: r.ordem,
    condicao: (r.condicao as CondicaoEtapa | null) ?? null,
  };
}

// ─── Semente ──────────────────────────────────────────────────────────────────

/**
 * Códigos já semeados alguma vez, como JSON array em `app_settings`.
 *
 * Guardar a lista (e não só um booleano) é o que separa "obrigação nova no
 * catálogo, ainda sem fluxo" de "obrigação cujas etapas o usuário apagou de
 * propósito". A primeira ganha as etapas padrão numa abertura futura; a
 * segunda fica vazia, como ele quis.
 */
const CHAVE_SEED = "fluxos_semeados";

async function lerCodigosSemeados(
  sqlite: Awaited<ReturnType<typeof getSqlite>>
): Promise<Set<string>> {
  const linhas = await sqlite.select<{ value: string }[]>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [CHAVE_SEED]
  );
  if (linhas.length === 0) return new Set();
  try {
    const lista = JSON.parse(linhas[0].value);
    return Array.isArray(lista) ? new Set(lista as string[]) : new Set();
  } catch {
    // Marca corrompida: trata como "nada semeado" em vez de derrubar o boot.
    return new Set();
  }
}

/**
 * Grava as etapas padrão das obrigações que nunca foram semeadas. Roda a cada
 * boot e é barata: normalmente não tem nada a fazer.
 */
export async function semearFluxos(): Promise<void> {
  const sqlite = await getSqlite();
  const semeados = await lerCodigosSemeados(sqlite);

  const novos = CATALOGO_OBRIGACOES.filter((d) => !semeados.has(d.codigo));
  if (novos.length === 0) return;

  const ts = agora();
  for (const def of novos) {
    const etapas = fluxoPadrao(def.codigo);
    for (let i = 0; i < etapas.length; i++) {
      await sqlite.execute(
        `INSERT INTO obrigacao_fluxo_etapas
           (id, obrigacao_codigo, descricao, ordem, condicao, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          def.codigo,
          etapas[i].descricao,
          i,
          etapas[i].condicao ?? null,
          ts,
          ts,
        ]
      );
    }
    semeados.add(def.codigo);
  }

  await sqlite.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [CHAVE_SEED, JSON.stringify([...semeados]), ts]
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Todas as etapas configuradas, agrupadas por código de obrigação. */
export async function listarFluxos(): Promise<Map<string, EtapaFluxo[]>> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<EtapaFluxoRow[]>(
    `SELECT id, obrigacao_codigo, descricao, ordem, condicao
       FROM obrigacao_fluxo_etapas
      ORDER BY obrigacao_codigo ASC, ordem ASC`
  );
  const mapa = new Map<string, EtapaFluxo[]>();
  for (const r of rows) {
    const lista = mapa.get(r.obrigacao_codigo) ?? [];
    lista.push(mapearLinha(r));
    mapa.set(r.obrigacao_codigo, lista);
  }
  return mapa;
}

export async function listarEtapasDoFluxo(
  obrigacaoCodigo: string
): Promise<EtapaFluxo[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<EtapaFluxoRow[]>(
    `SELECT id, obrigacao_codigo, descricao, ordem, condicao
       FROM obrigacao_fluxo_etapas
      WHERE obrigacao_codigo = ?
      ORDER BY ordem ASC`,
    [obrigacaoCodigo]
  );
  return rows.map(mapearLinha);
}

export async function adicionarEtapaFluxo(
  obrigacaoCodigo: string,
  dados: DadosEtapaFluxo
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  const ultimo = await sqlite.select<{ n: number | null }[]>(
    `SELECT MAX(ordem) AS n FROM obrigacao_fluxo_etapas WHERE obrigacao_codigo = ?`,
    [obrigacaoCodigo]
  );
  const ordem = (ultimo[0]?.n ?? -1) + 1;
  await sqlite.execute(
    `INSERT INTO obrigacao_fluxo_etapas
       (id, obrigacao_codigo, descricao, ordem, condicao, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      obrigacaoCodigo,
      dados.descricao.trim(),
      ordem,
      dados.condicao,
      ts,
      ts,
    ]
  );
}

export async function editarEtapaFluxo(
  id: string,
  dados: DadosEtapaFluxo
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE obrigacao_fluxo_etapas
        SET descricao = ?, condicao = ?, updated_at = ?
      WHERE id = ?`,
    [dados.descricao.trim(), dados.condicao, agora(), id]
  );
}

export async function excluirEtapaFluxo(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM obrigacao_fluxo_etapas WHERE id = ?`, [id]);
}

/** Move a etapa uma posição para cima/baixo, trocando a ordem com a vizinha. */
export async function moverEtapaFluxo(
  id: string,
  direcao: "cima" | "baixo"
): Promise<void> {
  const sqlite = await getSqlite();
  const atual = await sqlite.select<EtapaFluxoRow[]>(
    `SELECT id, obrigacao_codigo, descricao, ordem, condicao
       FROM obrigacao_fluxo_etapas WHERE id = ?`,
    [id]
  );
  if (atual.length === 0) return;
  const etapa = atual[0];

  const vizinhas = await sqlite.select<EtapaFluxoRow[]>(
    direcao === "cima"
      ? `SELECT id, obrigacao_codigo, descricao, ordem, condicao
           FROM obrigacao_fluxo_etapas
          WHERE obrigacao_codigo = ? AND ordem < ?
          ORDER BY ordem DESC LIMIT 1`
      : `SELECT id, obrigacao_codigo, descricao, ordem, condicao
           FROM obrigacao_fluxo_etapas
          WHERE obrigacao_codigo = ? AND ordem > ?
          ORDER BY ordem ASC LIMIT 1`,
    [etapa.obrigacao_codigo, etapa.ordem]
  );
  if (vizinhas.length === 0) return;
  const vizinha = vizinhas[0];

  const ts = agora();
  await sqlite.execute(
    `UPDATE obrigacao_fluxo_etapas SET ordem = ?, updated_at = ? WHERE id = ?`,
    [vizinha.ordem, ts, etapa.id]
  );
  await sqlite.execute(
    `UPDATE obrigacao_fluxo_etapas SET ordem = ?, updated_at = ? WHERE id = ?`,
    [etapa.ordem, ts, vizinha.id]
  );
}
