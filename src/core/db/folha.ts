/**
 * Folha de pagamento mensal por empresa.
 *
 * A competência é aberta pré-preenchida com quem estava ativo no mês —
 * funcionários admitidos e não demitidos, sócios com retirada vigente — e os
 * valores nascem calculados. Editar um item recalcula só ele.
 *
 * Fechar a competência é o que a transforma em histórico: é a folha **fechada**
 * que alimenta o Fator R, porque um rascunho entrando no cálculo mudaria o
 * anexo da empresa sem ninguém mandar.
 */

import { getSqlite } from "./client";
import { agora } from "@/utils/dates";
import {
  calcularItemProLabore,
  calcularItemSalario,
  folhaRealParaFatorR,
  type ParametrosEncargo,
} from "@/consts/folha";
import type { AnexoSimples, RegimeTributario } from "./empresas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusFolha = "ABERTA" | "FECHADA";
export type TipoItemFolha = "SALARIO" | "PRO_LABORE";

export type ItemFolha = {
  id: string;
  tipo: TipoItemFolha;
  funcionarioId: string | null;
  socioId: string | null;
  nome: string;
  baseCents: number;
  decimoTerceiroCents: number;
  feriasCents: number;
  tercoFeriasCents: number;
  outrosProventosCents: number;
  inssCents: number;
  irrfCents: number;
  outrosDescontosCents: number;
  dependentes: number;
  fgtsCents: number;
  cppCents: number;
  ratCents: number;
  terceirosCents: number;
  /** Derivados, para a tela não recalcular. */
  proventosCents: number;
  descontosCents: number;
  liquidoCents: number;
  encargosCents: number;
};

export type FolhaCompetencia = {
  id: string;
  empresaId: string;
  mes: number;
  ano: number;
  status: StatusFolha;
  fechadaEm: string | null;
  ratCentesimos: number;
  fapDecimilesimos: number;
  terceirosCentesimos: number;
  itens: ItemFolha[];
  /** Totais da competência. */
  totalProventosCents: number;
  totalDescontosCents: number;
  totalLiquidoCents: number;
  totalEncargosCents: number;
  custoTotalCents: number;
};

/** Dados da empresa necessários para calcular a folha. */
export type EmpresaParaFolha = {
  id: string;
  regimeTributario: RegimeTributario;
  anexoSimples: AnexoSimples | null;
  ratCentesimos: number;
  fapDecimilesimos: number;
  terceirosCentesimos: number;
};

type FolhaRow = {
  id: string;
  empresa_id: string;
  mes: number;
  ano: number;
  status: string;
  fechada_em: string | null;
  rat_centesimos: number;
  fap_decimilesimos: number;
  terceiros_centesimos: number;
};

type ItemRow = {
  id: string;
  folha_id: string;
  tipo: string;
  funcionario_id: string | null;
  socio_id: string | null;
  nome: string;
  base_cents: number;
  decimo_terceiro_cents: number;
  ferias_cents: number;
  terco_ferias_cents: number;
  outros_proventos_cents: number;
  inss_cents: number;
  irrf_cents: number;
  outros_descontos_cents: number;
  dependentes: number;
  fgts_cents: number;
  cpp_cents: number;
  rat_cents: number;
  terceiros_cents: number;
};

const COLUNAS_ITEM = `id, folha_id, tipo, funcionario_id, socio_id, nome,
  base_cents, decimo_terceiro_cents, ferias_cents, terco_ferias_cents,
  outros_proventos_cents, inss_cents, irrf_cents, outros_descontos_cents,
  dependentes, fgts_cents, cpp_cents, rat_cents, terceiros_cents`;

function mapearItem(r: ItemRow): ItemFolha {
  const proventosCents =
    r.base_cents +
    r.decimo_terceiro_cents +
    r.ferias_cents +
    r.terco_ferias_cents +
    r.outros_proventos_cents;
  const descontosCents = r.inss_cents + r.irrf_cents + r.outros_descontos_cents;
  const encargosCents =
    r.fgts_cents + r.cpp_cents + r.rat_cents + r.terceiros_cents;

  return {
    id: r.id,
    tipo: r.tipo as TipoItemFolha,
    funcionarioId: r.funcionario_id ?? null,
    socioId: r.socio_id ?? null,
    nome: r.nome,
    baseCents: r.base_cents,
    decimoTerceiroCents: r.decimo_terceiro_cents,
    feriasCents: r.ferias_cents,
    tercoFeriasCents: r.terco_ferias_cents,
    outrosProventosCents: r.outros_proventos_cents,
    inssCents: r.inss_cents,
    irrfCents: r.irrf_cents,
    outrosDescontosCents: r.outros_descontos_cents,
    dependentes: r.dependentes,
    fgtsCents: r.fgts_cents,
    cppCents: r.cpp_cents,
    ratCents: r.rat_cents,
    terceirosCents: r.terceiros_cents,
    proventosCents,
    descontosCents,
    liquidoCents: proventosCents - descontosCents,
    encargosCents,
  };
}

function montarFolha(f: FolhaRow, itens: ItemFolha[]): FolhaCompetencia {
  const totalProventosCents = itens.reduce((a, i) => a + i.proventosCents, 0);
  const totalDescontosCents = itens.reduce((a, i) => a + i.descontosCents, 0);
  const totalEncargosCents = itens.reduce((a, i) => a + i.encargosCents, 0);

  return {
    id: f.id,
    empresaId: f.empresa_id,
    mes: f.mes,
    ano: f.ano,
    status: f.status as StatusFolha,
    fechadaEm: f.fechada_em ?? null,
    ratCentesimos: f.rat_centesimos,
    fapDecimilesimos: f.fap_decimilesimos,
    terceirosCentesimos: f.terceiros_centesimos,
    itens,
    totalProventosCents,
    totalDescontosCents,
    totalLiquidoCents: totalProventosCents - totalDescontosCents,
    totalEncargosCents,
    custoTotalCents: totalProventosCents + totalEncargosCents,
  };
}

function parametros(e: EmpresaParaFolha): ParametrosEncargo {
  return {
    regime: e.regimeTributario,
    anexoSimples: e.anexoSimples,
    ratCentesimos: e.ratCentesimos,
    fapDecimilesimos: e.fapDecimilesimos,
    terceirosCentesimos: e.terceirosCentesimos,
  };
}

// ─── Abertura da competência ──────────────────────────────────────────────────

/** Último dia do mês, em ISO — usado para saber quem estava ativo. */
function fimDoMes(mes: number, ano: number): string {
  const ultimo = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

function inicioDoMes(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

/**
 * Abre (ou devolve) a folha da competência, pré-preenchida.
 *
 * Idempotente: chamar de novo numa competência já aberta devolve o que está
 * gravado, sem recalcular por cima de edição manual.
 */
export async function obterOuCriarFolha(
  empresa: EmpresaParaFolha,
  mes: number,
  ano: number
): Promise<FolhaCompetencia> {
  const sqlite = await getSqlite();

  const existentes = await sqlite.select<FolhaRow[]>(
    `SELECT id, empresa_id, mes, ano, status, fechada_em,
            rat_centesimos, fap_decimilesimos, terceiros_centesimos
       FROM folha_competencias
      WHERE empresa_id = ? AND mes = ? AND ano = ?`,
    [empresa.id, mes, ano]
  );

  if (existentes.length > 0) {
    return carregarFolha(existentes[0]);
  }

  const ts = agora();
  const folhaId = crypto.randomUUID();

  await sqlite.execute(
    `INSERT INTO folha_competencias
       (id, empresa_id, mes, ano, status, rat_centesimos, fap_decimilesimos,
        terceiros_centesimos, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ABERTA', ?, ?, ?, ?, ?)`,
    [
      folhaId,
      empresa.id,
      mes,
      ano,
      empresa.ratCentesimos,
      empresa.fapDecimilesimos,
      empresa.terceirosCentesimos,
      ts,
      ts,
    ]
  );

  const params = parametros(empresa);
  const inicio = inicioDoMes(mes, ano);
  const fim = fimDoMes(mes, ano);

  // Funcionários que estavam na empresa durante a competência: admitidos até o
  // fim do mês e não demitidos antes do começo dele.
  const funcionarios = await sqlite.select<
    { id: string; nome: string; salario_cents: number }[]
  >(
    `SELECT id, nome, salario_cents
       FROM funcionarios
      WHERE empresa_id = ? AND archived = 0
        AND (data_admissao IS NULL OR data_admissao <= ?)
        AND (data_demissao IS NULL OR data_demissao >= ?)
      ORDER BY nome COLLATE NOCASE ASC`,
    [empresa.id, fim, inicio]
  );

  for (const f of funcionarios) {
    const calc = calcularItemSalario(
      {
        baseCents: f.salario_cents,
        decimoTerceiroCents: 0,
        feriasCents: 0,
        tercoFeriasCents: 0,
        outrosProventosCents: 0,
      },
      0,
      0,
      params
    );
    await inserirItem(folhaId, "SALARIO", f.id, null, f.nome, f.salario_cents, calc, ts);
  }

  const socios = await sqlite.select<
    { socio_id: string; nome: string; pro_labore_cents: number }[]
  >(
    `SELECT es.socio_id, s.nome, es.pro_labore_cents
       FROM empresa_socios es
       JOIN socios s ON s.id = es.socio_id
      WHERE es.empresa_id = ? AND es.pro_labore_cents > 0
        AND (es.data_saida IS NULL OR es.data_saida >= ?)
        AND (es.data_entrada IS NULL OR es.data_entrada <= ?)
      ORDER BY s.nome COLLATE NOCASE ASC`,
    [empresa.id, inicio, fim]
  );

  for (const s of socios) {
    const calc = calcularItemProLabore(s.pro_labore_cents, 0, 0, params);
    await inserirItem(
      folhaId,
      "PRO_LABORE",
      null,
      s.socio_id,
      s.nome,
      s.pro_labore_cents,
      calc,
      ts
    );
  }

  const criada = await sqlite.select<FolhaRow[]>(
    `SELECT id, empresa_id, mes, ano, status, fechada_em,
            rat_centesimos, fap_decimilesimos, terceiros_centesimos
       FROM folha_competencias WHERE id = ?`,
    [folhaId]
  );
  return carregarFolha(criada[0]);
}

type Calculado = ReturnType<typeof calcularItemSalario>;

async function inserirItem(
  folhaId: string,
  tipo: TipoItemFolha,
  funcionarioId: string | null,
  socioId: string | null,
  nome: string,
  baseCents: number,
  calc: Calculado,
  ts: string
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `INSERT INTO folha_itens
       (id, folha_id, tipo, funcionario_id, socio_id, nome, base_cents,
        inss_cents, irrf_cents, fgts_cents, cpp_cents, rat_cents, terceiros_cents,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      folhaId,
      tipo,
      funcionarioId,
      socioId,
      nome,
      baseCents,
      calc.inssCents,
      calc.irrfCents,
      calc.encargos.fgtsCents,
      calc.encargos.cppCents,
      calc.encargos.ratCents,
      calc.encargos.terceirosCents,
      ts,
      ts,
    ]
  );
}

async function carregarFolha(f: FolhaRow): Promise<FolhaCompetencia> {
  const sqlite = await getSqlite();
  const itens = await sqlite.select<ItemRow[]>(
    `SELECT ${COLUNAS_ITEM} FROM folha_itens
      WHERE folha_id = ?
      ORDER BY tipo DESC, nome COLLATE NOCASE ASC`,
    [f.id]
  );
  return montarFolha(f, itens.map(mapearItem));
}

// ─── Edição ───────────────────────────────────────────────────────────────────

export type EdicaoItemFolha = {
  baseCents: number;
  decimoTerceiroCents: number;
  feriasCents: number;
  tercoFeriasCents: number;
  outrosProventosCents: number;
  outrosDescontosCents: number;
  dependentes: number;
};

/**
 * Grava um item e recalcula os tributos e encargos dele.
 *
 * O recálculo mora aqui, e não na tela, porque os valores gravados são o
 * histórico: se a tela mostrasse um número e o banco guardasse outro, a folha
 * fechada mentiria para o Fator R.
 */
export async function salvarItemFolha(
  itemId: string,
  dados: EdicaoItemFolha,
  empresa: EmpresaParaFolha
): Promise<void> {
  const sqlite = await getSqlite();

  const linhas = await sqlite.select<{ tipo: string }[]>(
    `SELECT tipo FROM folha_itens WHERE id = ?`,
    [itemId]
  );
  if (linhas.length === 0) return;

  const params = parametros(empresa);
  const calc =
    linhas[0].tipo === "PRO_LABORE"
      ? calcularItemProLabore(
          dados.baseCents,
          dados.dependentes,
          dados.outrosDescontosCents,
          params
        )
      : calcularItemSalario(
          {
            baseCents: dados.baseCents,
            decimoTerceiroCents: dados.decimoTerceiroCents,
            feriasCents: dados.feriasCents,
            tercoFeriasCents: dados.tercoFeriasCents,
            outrosProventosCents: dados.outrosProventosCents,
          },
          dados.dependentes,
          dados.outrosDescontosCents,
          params
        );

  await sqlite.execute(
    `UPDATE folha_itens
        SET base_cents = ?, decimo_terceiro_cents = ?, ferias_cents = ?,
            terco_ferias_cents = ?, outros_proventos_cents = ?,
            outros_descontos_cents = ?, dependentes = ?,
            inss_cents = ?, irrf_cents = ?, fgts_cents = ?, cpp_cents = ?,
            rat_cents = ?, terceiros_cents = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.baseCents,
      dados.decimoTerceiroCents,
      dados.feriasCents,
      dados.tercoFeriasCents,
      dados.outrosProventosCents,
      dados.outrosDescontosCents,
      dados.dependentes,
      calc.inssCents,
      calc.irrfCents,
      calc.encargos.fgtsCents,
      calc.encargos.cppCents,
      calc.encargos.ratCents,
      calc.encargos.terceirosCents,
      agora(),
      itemId,
    ]
  );
}

export async function excluirItemFolha(itemId: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM folha_itens WHERE id = ?`, [itemId]);
}

export async function definirStatusFolha(
  folhaId: string,
  status: StatusFolha
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  await sqlite.execute(
    `UPDATE folha_competencias
        SET status = ?, fechada_em = ?, updated_at = ?
      WHERE id = ?`,
    [status, status === "FECHADA" ? ts : null, ts, folhaId]
  );
}

// ─── Parâmetros de encargo da empresa ─────────────────────────────────────────

export async function definirParametrosEncargo(
  empresaId: string,
  ratCentesimos: number,
  fapDecimilesimos: number,
  terceirosCentesimos: number
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas
        SET rat_centesimos = ?, fap_decimilesimos = ?, terceiros_centesimos = ?,
            updated_at = ?
      WHERE id = ?`,
    [ratCentesimos, fapDecimilesimos, terceirosCentesimos, agora(), empresaId]
  );
}

// ─── Fator R a partir do histórico ────────────────────────────────────────────

export type FolhaHistorico = {
  /** Numerador do Fator R somando as competências fechadas encontradas. */
  totalCents: number;
  /** Quantas das 12 competências têm folha fechada. */
  competenciasFechadas: number;
};

/**
 * Soma as 12 competências fechadas anteriores à de apuração.
 *
 * Devolve também quantas foram encontradas: com o histórico incompleto a tela
 * precisa dizer isso, senão um Fator R baixo por falta de dado passa por
 * Fator R baixo de verdade — e o anexo indicado sai errado.
 */
export async function folha12mFechada(
  empresaId: string,
  mesApuracao: number,
  anoApuracao: number
): Promise<FolhaHistorico> {
  const sqlite = await getSqlite();

  // Os 12 meses **anteriores** à apuração — o mês apurado fica de fora, igual
  // ao RBT12 que serve de denominador. Somar janelas diferentes em cima e
  // embaixo da fração daria um Fator R que não existe.
  const fim = new Date(anoApuracao, mesApuracao - 2, 1);
  const inicio = new Date(anoApuracao, mesApuracao - 13, 1);

  const linhas = await sqlite.select<
    {
      id: string;
      mes: number;
      ano: number;
      proventos: number;
      cpp: number;
      fgts: number;
    }[]
  >(
    `SELECT f.id, f.mes, f.ano,
            COALESCE(SUM(i.base_cents + i.decimo_terceiro_cents + i.ferias_cents
                       + i.terco_ferias_cents + i.outros_proventos_cents), 0) AS proventos,
            COALESCE(SUM(i.cpp_cents), 0) AS cpp,
            COALESCE(SUM(i.fgts_cents), 0) AS fgts
       FROM folha_competencias f
       LEFT JOIN folha_itens i ON i.folha_id = f.id
      WHERE f.empresa_id = ? AND f.status = 'FECHADA'
        AND (f.ano * 12 + f.mes) >= ?
        AND (f.ano * 12 + f.mes) <= ?
      GROUP BY f.id`,
    [
      empresaId,
      inicio.getFullYear() * 12 + (inicio.getMonth() + 1),
      fim.getFullYear() * 12 + (fim.getMonth() + 1),
    ]
  );

  return {
    totalCents: folhaRealParaFatorR(
      linhas.map((l) => ({
        proventosCents: l.proventos,
        cppCents: l.cpp,
        fgtsCents: l.fgts,
      }))
    ),
    competenciasFechadas: linhas.length,
  };
}

/** Competências já registradas, da mais recente para a mais antiga. */
export async function listarCompetenciasFolha(
  empresaId: string
): Promise<{ mes: number; ano: number; status: StatusFolha }[]> {
  const sqlite = await getSqlite();
  return sqlite.select(
    `SELECT mes, ano, status FROM folha_competencias
      WHERE empresa_id = ? ORDER BY ano DESC, mes DESC`,
    [empresaId]
  );
}
