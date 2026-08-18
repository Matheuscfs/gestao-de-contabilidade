import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type RegimeTributario = "MEI" | "SIMPLES" | "PRESUMIDO" | "REAL";
export type AnexoSimples = "I" | "II" | "III" | "IV" | "V";
/** Opção da empresa na transição da reforma tributária (IBS/CBS). */
export type RegimeIbsCbs = "REGULAR" | "SIMPLES_DAS" | "SIMPLES_HIBRIDO";
export type StatusEmpresa = "ATIVA" | "INATIVA" | "BAIXADA";
/** Atividade para as presunções do Lucro Presumido. */
export type AtividadePresumido =
  | "COMERCIO_INDUSTRIA"
  | "TRANSPORTE_PASSAGEIROS"
  | "SERVICOS";

export const LABEL_REGIME: Record<RegimeTributario, string> = {
  MEI: "MEI",
  SIMPLES: "Simples Nacional",
  PRESUMIDO: "Lucro Presumido",
  REAL: "Lucro Real",
};

export type Empresa = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  /** Só dígitos (14). */
  cnpj: string;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  dataAbertura: string | null;
  cnaePrincipal: string | null;
  /** Descrição do CNAE principal, como a Receita devolve. */
  cnaeDescricao: string | null;
  /** CNAEs secundários na máscara 9999-9/99. Vazio quando não há. */
  cnaesSecundarios: string[];
  uf: string | null;
  municipio: string | null;
  regimeTributario: RegimeTributario;
  anexoSimples: AnexoSimples | null;
  /**
   * A atividade é sujeita ao teste do Fator R (LC 123 art. 18 §5º-D)?
   *
   * Só faz sentido nos Anexos III e V. Falso quando o Anexo III vem da
   * atividade (§5º-B) ou da regra residual (§5º-F) — aí a folha não muda nada
   * e comparar com os 28% só produziria alarme falso.
   */
  sujeitoFatorR: boolean;
  regimeIbsCbs: RegimeIbsCbs | null;
  atividadePresumido: AtividadePresumido | null;
  status: StatusEmpresa;
  /**
   * ISO YYYY-MM-DD do encerramento. Null enquanto a empresa não foi baixada.
   *
   * É o que separa "não gerar mais nada" de "apagar o passado": empresa
   * baixada em março ainda deve as obrigações até março, e elas continuam na
   * agenda.
   */
  dataBaixa: string | null;
  temFuncionarios: boolean;
  email: string | null;
  telefone: string | null;
  /** Honorário mensal cobrado pelo escritório, em centavos. */
  honorariosCents: number;
  /** Capital social / quotas, em centavos. */
  capitalSocialCents: number;
  /** Quem detém a procuração eletrônica (e-CAC). */
  procuracaoResponsavel: string | null;
  /**
   * Ativa porém sem movimento no período: continua entregando as obrigações,
   * só que zeradas. Não é status de ciclo de vida — por isso é flag.
   */
  semMovimento: boolean;
  /** RAT em centésimos de % (100 = 1%), pelo grau de risco do CNAE. */
  ratCentesimos: number;
  /** FAP em decimilésimos (10000 = 1,0000); multiplica o RAT. */
  fapDecimilesimos: number;
  /** Terceiros / Sistema S em centésimos de % (580 = 5,8%). */
  terceirosCentesimos: number;
  /** Dia do vencimento do ISS no município da empresa. */
  issDiaVencimento: number;
  /** Alíquota do ISS em centésimos de % (500 = 5%). Zero = não informada. */
  issAliquotaCentesimos: number;
  /** Sociedade de profissão regulamentada — bloqueia a presunção reduzida. */
  profissaoRegulamentada: boolean;
  /** Dia em que o honorário deste cliente vence. Varia por contrato. */
  honorarioDiaVencimento: number;
  notes: string | null;
  createdAt: string;
};

export type EmpresaComTotais = Empresa & {
  /** Sócios com vínculo vigente (sem data de saída). */
  sociosCount: number;
  /** Funcionários ativos (sem data de demissão). */
  funcionariosCount: number;
  /** Soma dos pró-labores mensais dos vínculos vigentes, em centavos. */
  proLaboreTotalCents: number;
};

export type DadosEmpresa = {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  dataAbertura: string | null;
  cnaePrincipal: string | null;
  cnaeDescricao: string | null;
  cnaesSecundarios: string[];
  uf: string | null;
  municipio: string | null;
  regimeTributario: RegimeTributario;
  anexoSimples: AnexoSimples | null;
  sujeitoFatorR: boolean;
  regimeIbsCbs: RegimeIbsCbs | null;
  status: StatusEmpresa;
  temFuncionarios: boolean;
  email: string | null;
  telefone: string | null;
  honorariosCents: number;
  capitalSocialCents: number;
  procuracaoResponsavel: string | null;
  semMovimento: boolean;
  issDiaVencimento: number;
  issAliquotaCentesimos: number;
  profissaoRegulamentada: boolean;
  honorarioDiaVencimento: number;
  notes: string | null;
};

type EmpresaRow = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  data_abertura: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  cnaes_secundarios: string | null;
  uf: string | null;
  municipio: string | null;
  regime_tributario: string;
  anexo_simples: string | null;
  sujeito_fator_r: number;
  regime_ibs_cbs: string | null;
  atividade_presumido: string | null;
  status: string;
  data_baixa: string | null;
  tem_funcionarios: number;
  email: string | null;
  telefone: string | null;
  honorarios_cents: number;
  capital_social_cents: number;
  procuracao_responsavel: string | null;
  sem_movimento: number;
  rat_centesimos: number;
  fap_decimilesimos: number;
  terceiros_centesimos: number;
  iss_dia_vencimento: number;
  iss_aliquota_centesimos: number;
  profissao_regulamentada: number;
  honorario_dia_vencimento: number;
  notes: string | null;
  created_at: string;
};

type EmpresaComTotaisRow = EmpresaRow & {
  socios_count: number;
  funcionarios_count: number;
  pro_labore_total_cents: number;
};

/**
 * A coluna guarda um array JSON. Conteúdo inválido vira lista vazia em vez de
 * derrubar a leitura da empresa inteira — é campo informativo, não pode
 * quebrar a tela por causa de um caractere.
 */
function lerCnaesSecundarios(bruto: string | null): string[] {
  if (!bruto) return [];
  try {
    const v: unknown = JSON.parse(bruto);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Lista vazia grava NULL: array "[]" no banco só polui a leitura. */
function gravarCnaesSecundarios(lista: string[] | null | undefined): string | null {
  return lista && lista.length > 0 ? JSON.stringify(lista) : null;
}

function mapearLinha(r: EmpresaRow): Empresa {
  return {
    id: r.id,
    razaoSocial: r.razao_social,
    nomeFantasia: r.nome_fantasia ?? null,
    cnpj: r.cnpj,
    inscricaoEstadual: r.inscricao_estadual ?? null,
    inscricaoMunicipal: r.inscricao_municipal ?? null,
    dataAbertura: r.data_abertura ?? null,
    cnaePrincipal: r.cnae_principal ?? null,
    cnaeDescricao: r.cnae_descricao ?? null,
    cnaesSecundarios: lerCnaesSecundarios(r.cnaes_secundarios),
    uf: r.uf ?? null,
    municipio: r.municipio ?? null,
    regimeTributario: r.regime_tributario as RegimeTributario,
    anexoSimples: (r.anexo_simples as AnexoSimples | null) ?? null,
    // Ausente vira `true` para casar com o DEFAULT 1 da migration: empresa já
    // cadastrada continua sendo avaliada pelo Fator R até alguém dizer que a
    // atividade não é do §5º-D.
    sujeitoFatorR: (r.sujeito_fator_r ?? 1) === 1,
    regimeIbsCbs: (r.regime_ibs_cbs as RegimeIbsCbs | null) ?? null,
    atividadePresumido:
      (r.atividade_presumido as AtividadePresumido | null) ?? null,
    status: r.status as StatusEmpresa,
    dataBaixa: r.data_baixa ?? null,
    temFuncionarios: r.tem_funcionarios === 1,
    email: r.email ?? null,
    telefone: r.telefone ?? null,
    honorariosCents: r.honorarios_cents ?? 0,
    capitalSocialCents: r.capital_social_cents ?? 0,
    procuracaoResponsavel: r.procuracao_responsavel ?? null,
    semMovimento: r.sem_movimento === 1,
    ratCentesimos: r.rat_centesimos ?? 100,
    fapDecimilesimos: r.fap_decimilesimos ?? 10_000,
    terceirosCentesimos: r.terceiros_centesimos ?? 0,
    issDiaVencimento: r.iss_dia_vencimento ?? 10,
    issAliquotaCentesimos: r.iss_aliquota_centesimos ?? 0,
    profissaoRegulamentada: r.profissao_regulamentada === 1,
    honorarioDiaVencimento: r.honorario_dia_vencimento ?? 10,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  };
}

const COLUNAS = `id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
  inscricao_municipal, data_abertura, cnae_principal, cnae_descricao, cnaes_secundarios, uf, municipio,
  regime_tributario, anexo_simples, sujeito_fator_r, regime_ibs_cbs, atividade_presumido,
  status, data_baixa, tem_funcionarios, email, telefone, honorarios_cents,
  capital_social_cents, procuracao_responsavel, sem_movimento,
  rat_centesimos, fap_decimilesimos, terceiros_centesimos,
  iss_dia_vencimento, iss_aliquota_centesimos, profissao_regulamentada,
  honorario_dia_vencimento, notes, created_at`;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarEmpresas(): Promise<EmpresaComTotais[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<EmpresaComTotaisRow[]>(
    `SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual,
            e.inscricao_municipal, e.data_abertura, e.cnae_principal, e.cnae_descricao,
            e.cnaes_secundarios, e.uf, e.municipio,
            e.regime_tributario, e.anexo_simples, e.sujeito_fator_r, e.regime_ibs_cbs,
            e.atividade_presumido,
            e.status, e.data_baixa, e.tem_funcionarios, e.email, e.telefone,
            e.honorarios_cents,
            e.capital_social_cents, e.procuracao_responsavel, e.sem_movimento,
            e.rat_centesimos, e.fap_decimilesimos, e.terceiros_centesimos,
            e.iss_dia_vencimento, e.iss_aliquota_centesimos, e.profissao_regulamentada,
            e.honorario_dia_vencimento, e.notes, e.created_at,
            (SELECT COUNT(*) FROM empresa_socios es
              WHERE es.empresa_id = e.id AND es.data_saida IS NULL) AS socios_count,
            (SELECT COUNT(*) FROM funcionarios f
              WHERE f.empresa_id = e.id AND f.archived = 0 AND f.data_demissao IS NULL) AS funcionarios_count,
            (SELECT COALESCE(SUM(es.pro_labore_cents), 0) FROM empresa_socios es
              WHERE es.empresa_id = e.id AND es.data_saida IS NULL) AS pro_labore_total_cents
       FROM empresas e
      WHERE e.archived = 0
      ORDER BY e.razao_social COLLATE NOCASE ASC`
  );
  return rows.map((r) => ({
    ...mapearLinha(r),
    sociosCount: r.socios_count,
    funcionariosCount: r.funcionarios_count,
    proLaboreTotalCents: r.pro_labore_total_cents,
  }));
}

export async function obterEmpresa(id: string): Promise<Empresa | null> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<EmpresaRow[]>(
    `SELECT ${COLUNAS} FROM empresas WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? mapearLinha(rows[0]) : null;
}

/** Verifica se já existe empresa ativa com este CNPJ (ignorando a própria, na edição). */
export async function cnpjJaCadastrado(
  cnpj: string,
  ignorarId?: string
): Promise<boolean> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM empresas WHERE cnpj = ? AND archived = 0 AND id != ?`,
    [cnpj, ignorarId ?? ""]
  );
  return rows[0].n > 0;
}

export async function criarEmpresa(dados: DadosEmpresa): Promise<string> {
  const sqlite = await getSqlite();
  const id = crypto.randomUUID();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO empresas
       (id, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal,
        data_abertura, cnae_principal, cnae_descricao, cnaes_secundarios, uf, municipio, regime_tributario,
        anexo_simples, sujeito_fator_r,
        regime_ibs_cbs, status, tem_funcionarios, email, telefone, honorarios_cents,
        capital_social_cents, procuracao_responsavel, sem_movimento,
        iss_dia_vencimento, iss_aliquota_centesimos, profissao_regulamentada,
        honorario_dia_vencimento, notes, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      dados.razaoSocial.trim(),
      dados.nomeFantasia?.trim() || null,
      dados.cnpj,
      dados.inscricaoEstadual?.trim() || null,
      dados.inscricaoMunicipal?.trim() || null,
      dados.dataAbertura,
      dados.cnaePrincipal?.trim() || null,
      dados.cnaeDescricao?.trim() || null,
      gravarCnaesSecundarios(dados.cnaesSecundarios),
      dados.uf,
      dados.municipio?.trim() || null,
      dados.regimeTributario,
      dados.regimeTributario === "SIMPLES" ? dados.anexoSimples : null,
      dados.sujeitoFatorR ? 1 : 0,
      dados.regimeIbsCbs,
      dados.status,
      dados.temFuncionarios ? 1 : 0,
      dados.email?.trim() || null,
      dados.telefone?.trim() || null,
      dados.honorariosCents,
      dados.capitalSocialCents,
      dados.procuracaoResponsavel?.trim() || null,
      dados.semMovimento ? 1 : 0,
      dados.issDiaVencimento,
      dados.issAliquotaCentesimos,
      dados.profissaoRegulamentada ? 1 : 0,
      dados.honorarioDiaVencimento,
      dados.notes?.trim() || null,
      ts,
      ts,
    ]
  );
  return id;
}

export async function editarEmpresa(
  id: string,
  dados: DadosEmpresa
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas
        SET razao_social = ?, nome_fantasia = ?, cnpj = ?, inscricao_estadual = ?,
            inscricao_municipal = ?, data_abertura = ?, cnae_principal = ?,
            cnae_descricao = ?, cnaes_secundarios = ?, uf = ?,
            municipio = ?, regime_tributario = ?, anexo_simples = ?,
            sujeito_fator_r = ?, regime_ibs_cbs = ?,
            status = ?, tem_funcionarios = ?, email = ?, telefone = ?,
            honorarios_cents = ?, capital_social_cents = ?, procuracao_responsavel = ?,
            sem_movimento = ?, iss_dia_vencimento = ?, iss_aliquota_centesimos = ?,
            profissao_regulamentada = ?, honorario_dia_vencimento = ?,
            notes = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.razaoSocial.trim(),
      dados.nomeFantasia?.trim() || null,
      dados.cnpj,
      dados.inscricaoEstadual?.trim() || null,
      dados.inscricaoMunicipal?.trim() || null,
      dados.dataAbertura,
      dados.cnaePrincipal?.trim() || null,
      dados.cnaeDescricao?.trim() || null,
      gravarCnaesSecundarios(dados.cnaesSecundarios),
      dados.uf,
      dados.municipio?.trim() || null,
      dados.regimeTributario,
      dados.regimeTributario === "SIMPLES" ? dados.anexoSimples : null,
      dados.sujeitoFatorR ? 1 : 0,
      dados.regimeIbsCbs,
      dados.status,
      dados.temFuncionarios ? 1 : 0,
      dados.email?.trim() || null,
      dados.telefone?.trim() || null,
      dados.honorariosCents,
      dados.capitalSocialCents,
      dados.procuracaoResponsavel?.trim() || null,
      dados.semMovimento ? 1 : 0,
      dados.issDiaVencimento,
      dados.issAliquotaCentesimos,
      dados.profissaoRegulamentada ? 1 : 0,
      dados.honorarioDiaVencimento,
      dados.notes?.trim() || null,
      agora(),
      id,
    ]
  );
}

/** Define a opção da empresa na transição da reforma tributária (aba Reforma). */
export async function definirRegimeIbsCbs(
  id: string,
  regime: RegimeIbsCbs
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas SET regime_ibs_cbs = ?, updated_at = ? WHERE id = ?`,
    [regime, agora(), id]
  );
}

/**
 * Troca o regime tributário direto da aba Tributos.
 *
 * Zera `anexo_simples` ao sair do Simples pela mesma razão que
 * `criarEmpresa`/`editarEmpresa` fazem isso: anexo é conceito exclusivo do
 * Simples, e deixá-lo para trás faria a empresa voltar ao Simples mais tarde
 * já enquadrada num anexo que ninguém reviu.
 */
export async function definirRegimeTributario(
  id: string,
  regime: RegimeTributario
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas
        SET regime_tributario = ?,
            anexo_simples = CASE WHEN ? = 'SIMPLES' THEN anexo_simples ELSE NULL END,
            updated_at = ?
      WHERE id = ?`,
    [regime, regime, agora(), id]
  );
}

/** Liga/desliga o teste do Fator R da atividade (LC 123 art. 18 §5º-D). */
export async function definirSujeitoFatorR(
  id: string,
  sujeito: boolean
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas SET sujeito_fator_r = ?, updated_at = ? WHERE id = ?`,
    [sujeito ? 1 : 0, agora(), id]
  );
}

/** Define a atividade usada nas presunções do Lucro Presumido (aba Tributos). */
export async function definirAtividadePresumido(
  id: string,
  atividade: AtividadePresumido
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas SET atividade_presumido = ?, updated_at = ? WHERE id = ?`,
    [atividade, agora(), id]
  );
}

// ─── Baixa ────────────────────────────────────────────────────────────────────

export type EfeitosDaBaixa = {
  /** Obrigações pendentes de competência posterior à baixa. */
  obrigacoesPendentes: number;
  /** Cobranças em aberto de competência posterior à baixa. */
  cobrancasEmAberto: number;
  cobrancasEmAbertoCents: number;
};

/** Competência AAAA-MM da data da baixa — a fronteira de todo o resto. */
function competenciaDaBaixa(dataBaixa: string): string {
  return dataBaixa.slice(0, 7);
}

/**
 * O que a baixa vai encerrar, contado antes de encerrar.
 *
 * A tela mostra estes números na confirmação: fechar obrigação e apagar
 * cobrança sem dizer quantas seriam uma ação destrutiva às cegas.
 */
export async function previaDaBaixa(
  id: string,
  dataBaixa: string
): Promise<EfeitosDaBaixa> {
  const sqlite = await getSqlite();
  const comp = competenciaDaBaixa(dataBaixa);
  const [ano, mes] = comp.split("-").map(Number);
  const limite = ano * 12 + mes;

  const [obrig] = await sqlite.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM obrigacoes_ocorrencias
      WHERE empresa_id = ? AND status = 'PENDENTE'
        AND (competencia_ano * 12 + competencia_mes) > ?`,
    [id, limite]
  );
  const [cobr] = await sqlite.select<{ n: number; total: number }[]>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(valor_cents), 0) AS total
       FROM financeiro_lancamentos
      WHERE empresa_id = ? AND direcao = 'RECEBER'
        AND data_pagamento IS NULL AND competencia > ?`,
    [id, comp]
  );

  return {
    obrigacoesPendentes: obrig.n,
    cobrancasEmAberto: cobr.n,
    cobrancasEmAbertoCents: cobr.total,
  };
}

/**
 * Dá baixa na empresa: encerra o cadastro e limpa o que ficou agendado para
 * depois do encerramento.
 *
 * O corte é por **competência**, não pela data exata. Empresa baixada em 20/03
 * ainda deve as obrigações e o honorário de março — o que não pode sobreviver
 * é abril em diante.
 *
 * Obrigação pendente vira DISPENSADA em vez de ser apagada: é um estado que já
 * existe, aparece na agenda e o usuário reverte item a item se a baixa foi
 * engano. Cobrança em aberto é apagada mesmo — cobrança que nunca será feita
 * de empresa que não existe mais só distorce o total a receber, e "gerar
 * mensalidades" recria se a empresa voltar.
 *
 * O que já foi entregue, pago ou fechado não é tocado: baixa encerra o futuro,
 * não reescreve o histórico.
 */
export async function darBaixaEmpresa(
  id: string,
  dataBaixa: string
): Promise<EfeitosDaBaixa> {
  const sqlite = await getSqlite();
  const efeitos = await previaDaBaixa(id, dataBaixa);
  const comp = competenciaDaBaixa(dataBaixa);
  const [ano, mes] = comp.split("-").map(Number);
  const limite = ano * 12 + mes;
  const ts = agora();

  await sqlite.execute(
    `UPDATE empresas SET status = 'BAIXADA', data_baixa = ?, updated_at = ? WHERE id = ?`,
    [dataBaixa, ts, id]
  );
  await sqlite.execute(
    `UPDATE obrigacoes_ocorrencias
        SET status = 'DISPENSADA', updated_at = ?
      WHERE empresa_id = ? AND status = 'PENDENTE'
        AND (competencia_ano * 12 + competencia_mes) > ?`,
    [ts, id, limite]
  );
  await sqlite.execute(
    `DELETE FROM financeiro_lancamentos
      WHERE empresa_id = ? AND direcao = 'RECEBER'
        AND data_pagamento IS NULL AND competencia > ?`,
    [id, comp]
  );

  return efeitos;
}

/**
 * Reativa a empresa. Não desfaz as dispensas nem recria as cobranças: as
 * obrigações voltam a ser geradas pelo motor na próxima abertura da empresa, e
 * as mensalidades pelo botão do financeiro. Ressuscitar automaticamente o que
 * foi encerrado traria de volta competência que talvez não deva existir.
 */
export async function reverterBaixaEmpresa(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas SET status = 'ATIVA', data_baixa = NULL, updated_at = ? WHERE id = ?`,
    [agora(), id]
  );
}

/**
 * Exclui a empresa e, por cascata (FK), os vínculos societários e os
 * funcionários dela. Sócios sem nenhum vínculo restante são removidos do
 * cadastro global para não deixar registros órfãos.
 */
export async function excluirEmpresa(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM empresas WHERE id = ?`, [id]);
  await sqlite.execute(
    `DELETE FROM socios
      WHERE id NOT IN (SELECT DISTINCT socio_id FROM empresa_socios)`
  );
}
