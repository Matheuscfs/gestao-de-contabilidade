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
  uf: string | null;
  municipio: string | null;
  regime_tributario: string;
  anexo_simples: string | null;
  sujeito_fator_r: number;
  regime_ibs_cbs: string | null;
  atividade_presumido: string | null;
  status: string;
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
  notes: string | null;
  created_at: string;
};

type EmpresaComTotaisRow = EmpresaRow & {
  socios_count: number;
  funcionarios_count: number;
  pro_labore_total_cents: number;
};

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
    notes: r.notes ?? null,
    createdAt: r.created_at,
  };
}

const COLUNAS = `id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
  inscricao_municipal, data_abertura, cnae_principal, cnae_descricao, uf, municipio,
  regime_tributario, anexo_simples, sujeito_fator_r, regime_ibs_cbs, atividade_presumido,
  status, tem_funcionarios, email, telefone, honorarios_cents,
  capital_social_cents, procuracao_responsavel, sem_movimento,
  rat_centesimos, fap_decimilesimos, terceiros_centesimos,
  iss_dia_vencimento, iss_aliquota_centesimos, profissao_regulamentada,
  notes, created_at`;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarEmpresas(): Promise<EmpresaComTotais[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<EmpresaComTotaisRow[]>(
    `SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual,
            e.inscricao_municipal, e.data_abertura, e.cnae_principal, e.cnae_descricao,
            e.uf, e.municipio,
            e.regime_tributario, e.anexo_simples, e.sujeito_fator_r, e.regime_ibs_cbs,
            e.atividade_presumido,
            e.status, e.tem_funcionarios, e.email, e.telefone, e.honorarios_cents,
            e.capital_social_cents, e.procuracao_responsavel, e.sem_movimento,
            e.rat_centesimos, e.fap_decimilesimos, e.terceiros_centesimos,
            e.iss_dia_vencimento, e.iss_aliquota_centesimos, e.profissao_regulamentada,
            e.notes, e.created_at,
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
        data_abertura, cnae_principal, cnae_descricao, uf, municipio, regime_tributario,
        anexo_simples, sujeito_fator_r,
        regime_ibs_cbs, status, tem_funcionarios, email, telefone, honorarios_cents,
        capital_social_cents, procuracao_responsavel, sem_movimento,
        iss_dia_vencimento, iss_aliquota_centesimos, profissao_regulamentada,
        notes, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
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
            cnae_descricao = ?, uf = ?,
            municipio = ?, regime_tributario = ?, anexo_simples = ?,
            sujeito_fator_r = ?, regime_ibs_cbs = ?,
            status = ?, tem_funcionarios = ?, email = ?, telefone = ?,
            honorarios_cents = ?, capital_social_cents = ?, procuracao_responsavel = ?,
            sem_movimento = ?, iss_dia_vencimento = ?, iss_aliquota_centesimos = ?,
            profissao_regulamentada = ?, notes = ?, updated_at = ?
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
