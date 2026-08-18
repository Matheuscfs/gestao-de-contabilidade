/**
 * Lacunas de cadastro que impedem o cálculo — não são "campos vazios"
 * quaisquer, e sim os que travam alguma conta.
 *
 * Nasceu de um achado concreto da auditoria: as 24 empresas importadas da
 * planilha vieram sem anexo do Simples e sem valor de pró-labore, e nada na
 * interface dizia isso. A aba Tributos simplesmente não mostrava número
 * nenhum, sem explicar por quê.
 *
 * A regra para entrar aqui é essa: se o campo em branco faz um cálculo deixar
 * de existir ou sair errado, ele é pendência. Campo opcional que só enriquece
 * o cadastro não entra — a lista precisa caber numa tela e ser toda acionável.
 */

import { getSqlite } from "./client";
import type { AnexoSimples } from "./empresas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoPendencia =
  | "ANEXO_SIMPLES"
  | "PRO_LABORE"
  | "RECEITA_SEM_LANCAMENTO";

export type PendenciaEmpresa = {
  empresaId: string;
  razaoSocial: string;
  nomeExibicao: string;
  cnpj: string;
  anexoSimples: AnexoSimples | null;
  /** Sócios vinculados, com o pró-labore atual de cada um. */
  socios: {
    vinculoId: string;
    socioId: string;
    nome: string;
    proLaboreCents: number;
    isAdministrador: boolean;
  }[];
  /** O que falta nesta empresa. */
  faltando: TipoPendencia[];
  /**
   * A empresa já teve guia de pró-labore emitida em alguma competência?
   * É o sinal de que existe retirada e o valor é que não foi registrado —
   * diferente de quem legitimamente não retira.
   */
  jaEmitiuProLabore: boolean;
};

type LinhaEmpresa = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  regime_tributario: string;
  anexo_simples: string | null;
  pro_labore_emitido: number;
  receitas: number;
};

type LinhaSocio = {
  vinculo_id: string;
  socio_id: string;
  empresa_id: string;
  nome: string;
  pro_labore_cents: number;
  is_administrador: number;
};

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Empresas ativas com alguma lacuna que trave cálculo.
 *
 * `pro_labore_emitido` olha o histórico de obrigações: uma ocorrência de
 * INSS/DARF concluída significa que houve retirada naquele mês. É assim que a
 * lista distingue "esqueceram de registrar o valor" de "esta empresa não
 * retira pró-labore" — sem isso, metade das empresas apareceria como pendente
 * para sempre.
 */
export async function listarPendenciasCadastro(): Promise<PendenciaEmpresa[]> {
  const sqlite = await getSqlite();

  const [empresas, socios] = await Promise.all([
    sqlite.select<LinhaEmpresa[]>(
      `SELECT e.id, e.razao_social, e.nome_fantasia, e.cnpj,
              e.regime_tributario, e.anexo_simples,
              (SELECT COUNT(*) FROM obrigacoes_ocorrencias o
                WHERE o.empresa_id = e.id
                  AND o.obrigacao_codigo = 'INSS_DARF'
                  AND o.status IN ('ENTREGUE','PAGA')) AS pro_labore_emitido,
              (SELECT COUNT(*) FROM empresa_receitas r
                WHERE r.empresa_id = e.id AND r.receita_cents > 0) AS receitas
         FROM empresas e
        WHERE e.archived = 0 AND e.status = 'ATIVA'
        ORDER BY e.razao_social COLLATE NOCASE ASC`
    ),
    sqlite.select<LinhaSocio[]>(
      `SELECT es.id AS vinculo_id, es.socio_id, es.empresa_id, s.nome,
              es.pro_labore_cents, es.is_administrador
         FROM empresa_socios es
         JOIN socios s ON s.id = es.socio_id
        WHERE es.data_saida IS NULL
        ORDER BY s.nome COLLATE NOCASE ASC`
    ),
  ]);

  const sociosPorEmpresa = new Map<string, PendenciaEmpresa["socios"]>();
  for (const s of socios) {
    const lista = sociosPorEmpresa.get(s.empresa_id) ?? [];
    lista.push({
      vinculoId: s.vinculo_id,
      socioId: s.socio_id,
      nome: s.nome,
      proLaboreCents: s.pro_labore_cents,
      isAdministrador: s.is_administrador === 1,
    });
    sociosPorEmpresa.set(s.empresa_id, lista);
  }

  const resultado: PendenciaEmpresa[] = [];

  for (const e of empresas) {
    const listaSocios = sociosPorEmpresa.get(e.id) ?? [];
    const faltando: TipoPendencia[] = [];

    // Sem anexo, `calcularSimples` não escolhe tabela e a aba Tributos fica muda.
    if (e.regime_tributario === "SIMPLES" && !e.anexo_simples) {
      faltando.push("ANEXO_SIMPLES");
    }

    // Guia emitida no histórico + valor zerado = valor não registrado.
    const jaEmitiuProLabore = e.pro_labore_emitido > 0;
    const somaProLabore = listaSocios.reduce(
      (acc, s) => acc + s.proLaboreCents,
      0
    );
    if (jaEmitiuProLabore && somaProLabore === 0) {
      faltando.push("PRO_LABORE");
    }

    // Sem receita nenhuma não há RBT12, e sem RBT12 não há alíquota efetiva.
    if (e.receitas === 0) faltando.push("RECEITA_SEM_LANCAMENTO");

    if (faltando.length === 0) continue;

    resultado.push({
      empresaId: e.id,
      razaoSocial: e.razao_social,
      nomeExibicao: e.nome_fantasia || e.razao_social,
      cnpj: e.cnpj,
      anexoSimples: (e.anexo_simples as AnexoSimples | null) ?? null,
      socios: listaSocios,
      faltando,
      jaEmitiuProLabore,
    });
  }

  return resultado;
}

// ─── Correções pontuais ───────────────────────────────────────────────────────

/**
 * Define o anexo do Simples sem passar pelo formulário completo da empresa.
 *
 * O modal de cadastro exige revalidar CNPJ, regime e o resto; aqui a intenção
 * é outra — corrigir 21 empresas em sequência sem abrir 21 formulários.
 */
export async function definirAnexoSimples(
  empresaId: string,
  anexo: AnexoSimples
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresas SET anexo_simples = ?, updated_at = ? WHERE id = ?`,
    [anexo, new Date().toISOString(), empresaId]
  );
}

/** Define o pró-labore mensal de um vínculo societário. */
export async function definirProLabore(
  vinculoId: string,
  proLaboreCents: number
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresa_socios SET pro_labore_cents = ?, updated_at = ? WHERE id = ?`,
    [proLaboreCents, new Date().toISOString(), vinculoId]
  );
}
