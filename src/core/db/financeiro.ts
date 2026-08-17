/**
 * Financeiro do escritório: contas a receber dos clientes e a pagar da casa.
 *
 * Tudo é lançamento manual — este módulo não conversa com Open Finance nem com
 * as tabelas de finanças pessoais. É o caixa de quem presta o serviço, não o
 * do cliente.
 *
 * O status (em aberto / atrasado / pago) **não existe no banco**: sai de
 * `consts/financeiro.ts` a partir do vencimento e da data de pagamento. Ver o
 * porquê lá.
 */

import { getSqlite } from "./client";
import { agora } from "@/utils/dates";
import {
  statusLancamento,
  vencimentoDaCompetencia,
  type CategoriaLancamento,
  type DirecaoLancamento,
  type LancamentoBase,
  type StatusLancamento,
} from "@/consts/financeiro";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Lancamento = LancamentoBase & {
  id: string;
  direcao: DirecaoLancamento;
  /** Null nas despesas que não são de nenhum cliente. */
  empresaId: string | null;
  /** Nome congelado — continua legível mesmo se o cliente for excluído. */
  contraparte: string;
  descricao: string;
  categoria: CategoriaLancamento;
  /** AAAA-MM */
  competencia: string;
  formaPagamento: string | null;
  notes: string | null;
  createdAt: string;
};

export type DadosLancamento = {
  direcao: DirecaoLancamento;
  empresaId: string | null;
  contraparte: string;
  descricao: string;
  categoria: CategoriaLancamento;
  competencia: string;
  valorCents: number;
  vencimento: string;
  notes: string | null;
};

export type Baixa = {
  /** ISO YYYY-MM-DD */
  dataPagamento: string;
  valorPagoCents: number;
  formaPagamento: string | null;
};

type LancamentoRow = {
  id: string;
  direcao: string;
  empresa_id: string | null;
  contraparte: string;
  descricao: string;
  categoria: string;
  competencia: string;
  valor_cents: number;
  vencimento: string;
  data_pagamento: string | null;
  valor_pago_cents: number;
  forma_pagamento: string | null;
  notes: string | null;
  created_at: string;
};

function mapear(r: LancamentoRow): Lancamento {
  return {
    id: r.id,
    direcao: r.direcao as DirecaoLancamento,
    empresaId: r.empresa_id ?? null,
    contraparte: r.contraparte,
    descricao: r.descricao,
    categoria: r.categoria as CategoriaLancamento,
    competencia: r.competencia,
    valorCents: r.valor_cents,
    vencimento: r.vencimento,
    dataPagamento: r.data_pagamento ?? null,
    valorPagoCents: r.valor_pago_cents ?? 0,
    formaPagamento: r.forma_pagamento ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  };
}

const COLUNAS = `id, direcao, empresa_id, contraparte, descricao, categoria,
  competencia, valor_cents, vencimento, data_pagamento, valor_pago_cents,
  forma_pagamento, notes, created_at`;

// ─── Consultas ────────────────────────────────────────────────────────────────

/** Lançamentos de uma competência, vencimento mais próximo primeiro. */
export async function listarLancamentos(
  competencia: string
): Promise<Lancamento[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LancamentoRow[]>(
    `SELECT ${COLUNAS} FROM financeiro_lancamentos
      WHERE competencia = ?
      ORDER BY vencimento ASC, contraparte COLLATE NOCASE ASC`,
    [competencia]
  );
  return rows.map(mapear);
}

/**
 * Tudo que está em aberto e já venceu, de qualquer competência.
 *
 * Separado da consulta por mês de propósito: cobrança atrasada de abril não
 * pode sumir da tela só porque o usuário está olhando agosto.
 */
export async function listarVencidos(hojeIso: string): Promise<Lancamento[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LancamentoRow[]>(
    `SELECT ${COLUNAS} FROM financeiro_lancamentos
      WHERE data_pagamento IS NULL AND vencimento < ?
      ORDER BY vencimento ASC`,
    [hojeIso]
  );
  return rows.map(mapear);
}

/** Histórico completo de um cliente — é a base da pontualidade. */
export async function listarLancamentosDaEmpresa(
  empresaId: string
): Promise<Lancamento[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LancamentoRow[]>(
    `SELECT ${COLUNAS} FROM financeiro_lancamentos
      WHERE empresa_id = ?
      ORDER BY vencimento DESC`,
    [empresaId]
  );
  return rows.map(mapear);
}

/** Recebimentos de todos os clientes, para o painel de pontualidade. */
export async function listarRecebimentos(): Promise<Lancamento[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LancamentoRow[]>(
    `SELECT ${COLUNAS} FROM financeiro_lancamentos
      WHERE direcao = 'RECEBER'
      ORDER BY vencimento ASC`
  );
  return rows.map(mapear);
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

export async function criarLancamento(d: DadosLancamento): Promise<string> {
  const sqlite = await getSqlite();
  const id = crypto.randomUUID();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO financeiro_lancamentos
       (id, direcao, empresa_id, contraparte, descricao, categoria, competencia,
        valor_cents, vencimento, data_pagamento, valor_pago_cents,
        forma_pagamento, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?, ?)`,
    [
      id,
      d.direcao,
      d.empresaId,
      d.contraparte.trim(),
      d.descricao.trim(),
      d.categoria,
      d.competencia,
      d.valorCents,
      d.vencimento,
      d.notes?.trim() || null,
      ts,
      ts,
    ]
  );
  return id;
}

export async function editarLancamento(
  id: string,
  d: DadosLancamento
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE financeiro_lancamentos
        SET direcao = ?, empresa_id = ?, contraparte = ?, descricao = ?,
            categoria = ?, competencia = ?, valor_cents = ?, vencimento = ?,
            notes = ?, updated_at = ?
      WHERE id = ?`,
    [
      d.direcao,
      d.empresaId,
      d.contraparte.trim(),
      d.descricao.trim(),
      d.categoria,
      d.competencia,
      d.valorCents,
      d.vencimento,
      d.notes?.trim() || null,
      agora(),
      id,
    ]
  );
}

export async function excluirLancamento(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM financeiro_lancamentos WHERE id = ?`, [id]);
}

/** Baixa: registra o pagamento. É o que fecha o ciclo e alimenta a pontualidade. */
export async function registrarPagamento(id: string, b: Baixa): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE financeiro_lancamentos
        SET data_pagamento = ?, valor_pago_cents = ?, forma_pagamento = ?,
            updated_at = ?
      WHERE id = ?`,
    [b.dataPagamento, b.valorPagoCents, b.formaPagamento?.trim() || null, agora(), id]
  );
}

/** Desfaz a baixa — baixa errada acontece, e apagar o lançamento perderia o histórico. */
export async function desfazerPagamento(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE financeiro_lancamentos
        SET data_pagamento = NULL, valor_pago_cents = 0, forma_pagamento = NULL,
            updated_at = ?
      WHERE id = ?`,
    [agora(), id]
  );
}

// ─── Geração das mensalidades ─────────────────────────────────────────────────

export type ResultadoGeracao = {
  criadas: number;
  jaExistiam: number;
  /** Empresas ativas sem honorário cadastrado — não dá para cobrar o que não tem valor. */
  semHonorario: string[];
};

type EmpresaCobravel = {
  id: string;
  razao_social: string;
  honorarios_cents: number;
  honorario_dia_vencimento: number;
};

/**
 * Gera a mensalidade da competência para todo cliente ativo com honorário.
 *
 * Idempotente pelo índice único parcial `uq_financeiro_mensalidade`: rodar
 * duas vezes no mesmo mês não duplica nada. O `INSERT OR IGNORE` é o que
 * transforma "gerar o mês" num botão que pode ser clicado sem medo — mesma
 * mecânica do motor de obrigações.
 *
 * Só mexe em HONORARIO: serviço extra e reembolso continuam sendo lançamento
 * a dedo, porque não são previsíveis.
 */
export async function gerarMensalidades(
  competencia: string
): Promise<ResultadoGeracao> {
  const sqlite = await getSqlite();
  const empresas = await sqlite.select<EmpresaCobravel[]>(
    // Empresa baixada ainda é cobrada pelo mês em que foi baixada — o serviço
    // daquele mês foi prestado. A partir do mês seguinte, some da geração.
    `SELECT id, razao_social, honorarios_cents, honorario_dia_vencimento
       FROM empresas
      WHERE archived = 0
        AND (status = 'ATIVA'
             OR (data_baixa IS NOT NULL AND substr(data_baixa, 1, 7) >= ?))
      ORDER BY razao_social COLLATE NOCASE ASC`,
    [competencia]
  );

  const existentes = await sqlite.select<{ empresa_id: string }[]>(
    `SELECT empresa_id FROM financeiro_lancamentos
      WHERE competencia = ? AND direcao = 'RECEBER' AND categoria = 'HONORARIO'`,
    [competencia]
  );
  const jaTem = new Set(existentes.map((e) => e.empresa_id));

  const ts = agora();
  let criadas = 0;
  let jaExistiam = 0;
  const semHonorario: string[] = [];

  for (const e of empresas) {
    if (e.honorarios_cents <= 0) {
      semHonorario.push(e.razao_social);
      continue;
    }
    if (jaTem.has(e.id)) {
      jaExistiam++;
      continue;
    }
    const r = await sqlite.execute(
      `INSERT OR IGNORE INTO financeiro_lancamentos
         (id, direcao, empresa_id, contraparte, descricao, categoria, competencia,
          valor_cents, vencimento, data_pagamento, valor_pago_cents,
          forma_pagamento, notes, created_at, updated_at)
       VALUES (?, 'RECEBER', ?, ?, ?, 'HONORARIO', ?, ?, ?, NULL, 0, NULL, NULL, ?, ?)`,
      [
        crypto.randomUUID(),
        e.id,
        e.razao_social,
        `Honorário ${competencia}`,
        competencia,
        e.honorarios_cents,
        vencimentoDaCompetencia(competencia, e.honorario_dia_vencimento ?? 10),
        ts,
        ts,
      ]
    );
    // Conta o que o banco de fato gravou, não o que se tentou gravar: o
    // OR IGNORE existe justamente para o caso de a trava ter pegado.
    if (r.rowsAffected > 0) criadas++;
    else jaExistiam++;
  }

  return { criadas, jaExistiam, semHonorario };
}

// ─── Agregação para a tela ────────────────────────────────────────────────────

export type LancamentoComStatus = Lancamento & { status: StatusLancamento };

/** Anexa o status derivado — a tela nunca recalcula isso por conta própria. */
export function comStatus(
  lancamentos: Lancamento[],
  hojeIso: string
): LancamentoComStatus[] {
  return lancamentos.map((l) => ({ ...l, status: statusLancamento(l, hojeIso) }));
}
