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
  uf: string | null;
  municipio: string | null;
  regimeTributario: RegimeTributario;
  anexoSimples: AnexoSimples | null;
  regimeIbsCbs: RegimeIbsCbs | null;
  atividadePresumido: AtividadePresumido | null;
  status: StatusEmpresa;
  temFuncionarios: boolean;
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
  uf: string | null;
  municipio: string | null;
  regimeTributario: RegimeTributario;
  anexoSimples: AnexoSimples | null;
  regimeIbsCbs: RegimeIbsCbs | null;
  status: StatusEmpresa;
  temFuncionarios: boolean;
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
  uf: string | null;
  municipio: string | null;
  regime_tributario: string;
  anexo_simples: string | null;
  regime_ibs_cbs: string | null;
  atividade_presumido: string | null;
  status: string;
  tem_funcionarios: number;
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
    uf: r.uf ?? null,
    municipio: r.municipio ?? null,
    regimeTributario: r.regime_tributario as RegimeTributario,
    anexoSimples: (r.anexo_simples as AnexoSimples | null) ?? null,
    regimeIbsCbs: (r.regime_ibs_cbs as RegimeIbsCbs | null) ?? null,
    atividadePresumido:
      (r.atividade_presumido as AtividadePresumido | null) ?? null,
    status: r.status as StatusEmpresa,
    temFuncionarios: r.tem_funcionarios === 1,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  };
}

const COLUNAS = `id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
  inscricao_municipal, data_abertura, cnae_principal, uf, municipio,
  regime_tributario, anexo_simples, regime_ibs_cbs, atividade_presumido,
  status, tem_funcionarios, notes, created_at`;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarEmpresas(): Promise<EmpresaComTotais[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<EmpresaComTotaisRow[]>(
    `SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj, e.inscricao_estadual,
            e.inscricao_municipal, e.data_abertura, e.cnae_principal, e.uf, e.municipio,
            e.regime_tributario, e.anexo_simples, e.regime_ibs_cbs, e.atividade_presumido,
            e.status, e.tem_funcionarios, e.notes, e.created_at,
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
        data_abertura, cnae_principal, uf, municipio, regime_tributario, anexo_simples,
        regime_ibs_cbs, status, tem_funcionarios, notes, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      dados.razaoSocial.trim(),
      dados.nomeFantasia?.trim() || null,
      dados.cnpj,
      dados.inscricaoEstadual?.trim() || null,
      dados.inscricaoMunicipal?.trim() || null,
      dados.dataAbertura,
      dados.cnaePrincipal?.trim() || null,
      dados.uf,
      dados.municipio?.trim() || null,
      dados.regimeTributario,
      dados.regimeTributario === "SIMPLES" ? dados.anexoSimples : null,
      dados.regimeIbsCbs,
      dados.status,
      dados.temFuncionarios ? 1 : 0,
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
            inscricao_municipal = ?, data_abertura = ?, cnae_principal = ?, uf = ?,
            municipio = ?, regime_tributario = ?, anexo_simples = ?, regime_ibs_cbs = ?,
            status = ?, tem_funcionarios = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.razaoSocial.trim(),
      dados.nomeFantasia?.trim() || null,
      dados.cnpj,
      dados.inscricaoEstadual?.trim() || null,
      dados.inscricaoMunicipal?.trim() || null,
      dados.dataAbertura,
      dados.cnaePrincipal?.trim() || null,
      dados.uf,
      dados.municipio?.trim() || null,
      dados.regimeTributario,
      dados.regimeTributario === "SIMPLES" ? dados.anexoSimples : null,
      dados.regimeIbsCbs,
      dados.status,
      dados.temFuncionarios ? 1 : 0,
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
