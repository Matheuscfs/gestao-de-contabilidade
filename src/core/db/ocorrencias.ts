import { getDaysInMonth } from "date-fns";
import { agora, estaVigemNoMes } from "@/utils/dates";
import { getSqlite } from "./client";

// ─── Materialização de ocorrências ────────────────────────────────────────────
//
// O Quibo guarda REGRAS (modelos) e OCORRÊNCIAS na mesma tabela `transactions`:
//
//   modelo      → is_template = 1   (a receita, o custo fixo, a dívida cadastrada)
//   ocorrência  → is_template = 0   (o que de fato entra/sai naquela competência)
//
// As telas de Mês, Lançamentos e Extrato leem SOMENTE ocorrências. Este módulo é
// o motor que, dada uma competência (mês/ano), cria a ocorrência que falta para
// cada modelo vigente — uma, e apenas uma, por (modelo, mês, ano).
//
// Mapa de tipos (modelo → ocorrência):
//   INCOME      → INCOME
//   SALARY      → SALARY
//   LIVING_COST → LIVING_COST
//   DEBT        → DEBT_INSTALLMENT   (parcela, com número da parcela preenchido)
//
// O que este motor NUNCA toca:
//   • QUALQUER linha com source = 'PLUGGY'. São dois casos, e os dois ficam de
//     fora — as transações importadas já nascem como ocorrência real
//     (is_template = 0) e não têm modelo por trás; e os empréstimos/
//     financiamentos importados chegam como MODELO de dívida
//     (type = 'DEBT', is_template = 1, source = 'PLUGGY') mas também não podem
//     gerar parcela, porque o pagamento dela já entra sozinho como transação do
//     banco ("Loans and financing"). Materializar seria contar o mesmo dinheiro
//     duas vezes. Por isso só modelos MANUAIS são materializados;
//   • qualquer ocorrência que o usuário já confirmou (CONFIRMADO/PAGO);
//   • lançamentos avulsos criados à mão (parent_id NULL).
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de modelo que geram ocorrência mensal, e o tipo que cada um gera. */
const TIPO_DA_OCORRENCIA: Record<string, string> = {
  INCOME: "INCOME",
  SALARY: "SALARY",
  LIVING_COST: "LIVING_COST",
  DEBT: "DEBT_INSTALLMENT",
};

/** Status de modelo que encerram a regra — não geram mais nada. */
const STATUS_ENCERRADOS = new Set(["PAGO", "CANCELADO", "CONCLUIDO"]);

type ModeloRow = {
  id: string;
  type: string;
  status: string;
  description: string;
  amount_cents: number | null;
  category_id: string | null;
  persona_id: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  start_date: string | null;
  end_date: string | null;
  lc_day_of_month: number | null;
  sal_payment_day: number | null;
  dbt_installment_day: number | null;
  dbt_total_installments: number | null;
  dbt_remaining_installments: number | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Competência como número contínuo (ano × 12 + mês), fácil de comparar. */
function competenciaEmNumero(mes: number, ano: number): number {
  return ano * 12 + mes;
}

/**
 * Dia do vencimento do modelo naquela competência, já em 'YYYY-MM-DD'.
 * Usa o dia próprio de cada tipo, cai para o dia 1 quando não há dia definido e
 * encolhe para o último dia do mês quando o dia não existe (ex.: 31 em fevereiro).
 */
function dataDeVencimento(modelo: ModeloRow, mes: number, ano: number): string {
  const diaConfigurado =
    modelo.type === "LIVING_COST"
      ? modelo.lc_day_of_month
      : modelo.type === "DEBT"
        ? modelo.dbt_installment_day
        : modelo.sal_payment_day;

  const ultimoDia = getDaysInMonth(new Date(ano, mes - 1, 1));
  const dia = Math.min(Math.max(diaConfigurado ?? 1, 1), ultimoDia);

  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Competência em que o modelo foi cadastrado. Nada é gerado antes dela — o
 * usuário não quer o aluguel aparecendo em meses anteriores ao cadastro.
 * Data inválida/ausente = sem restrição.
 */
function competenciaDeCriacao(createdAt: string): number | null {
  const data = new Date(createdAt);
  if (Number.isNaN(data.getTime())) return null;
  return competenciaEmNumero(data.getMonth() + 1, data.getFullYear());
}

/** Quantas parcelas já foram geradas para uma dívida (em qualquer competência). */
async function contarParcelasGeradas(modeloId: string): Promise<number> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ total: number | null }[]>(
    `SELECT COUNT(*) AS total
       FROM transactions
      WHERE parent_id = ? AND type = 'DEBT_INSTALLMENT' AND is_template = 0`,
    [modeloId]
  );
  return rows[0]?.total ?? 0;
}

// ─── Motor ────────────────────────────────────────────────────────────────────

/**
 * Execuções em andamento, por competência. Duas chamadas simultâneas para o
 * mesmo mês (o efeito duplicado do StrictMode, por exemplo) compartilham a MESMA
 * promise — sem isso as duas leriam "não existe" antes de qualquer INSERT e
 * criariam a ocorrência em duplicidade.
 */
const execucoes = new Map<string, Promise<number>>();

/**
 * Gera as ocorrências que faltam na competência informada a partir dos modelos
 * cadastrados (receitas, salários, custos de vida e dívidas).
 *
 * É IDEMPOTENTE: a chave é (parent_id, month, year). Rodar de novo no mesmo mês
 * não cria nada e devolve 0. Pode (e deve) ser chamada toda vez que o usuário
 * abre o app ou troca de mês.
 *
 * @returns quantas ocorrências foram criadas nesta chamada.
 */
export function materializarOcorrencias(mes: number, ano: number): Promise<number> {
  const chave = `${ano}-${mes}`;
  const emAndamento = execucoes.get(chave);
  if (emAndamento) return emAndamento;

  const execucao = executarMaterializacao(mes, ano).finally(() => {
    execucoes.delete(chave);
  });
  execucoes.set(chave, execucao);
  return execucao;
}

async function executarMaterializacao(mes: number, ano: number): Promise<number> {
  const sqlite = await getSqlite();

  // Limpa ocorrências de modelos que não existem mais antes de gerar as novas.
  await removerOcorrenciasOrfas();

  // `source = 'MANUAL'` NÃO é sobra: o sync do Open Finance também grava modelos
  // de dívida (type = 'DEBT', is_template = 1, source = 'PLUGGY') para os
  // empréstimos/financiamentos do banco. Materializar esses modelos duplicaria o
  // gasto, porque o pagamento da parcela já chega como transação importada.
  const modelos = await sqlite.select<ModeloRow[]>(
    `SELECT id, type, status, description, amount_cents,
            category_id, persona_id, account_id, credit_card_id,
            start_date, end_date,
            lc_day_of_month, sal_payment_day,
            dbt_installment_day, dbt_total_installments, dbt_remaining_installments,
            created_at
       FROM transactions
      WHERE is_template = 1
        AND source = 'MANUAL'
        AND type IN ('INCOME', 'SALARY', 'LIVING_COST', 'DEBT')`
  );
  if (modelos.length === 0) return 0;

  // Tudo que já existe nesta competência, por modelo de origem. `month`/`year`
  // mandam; linhas antigas sem competência caem para o mês de date/due_date.
  //
  // Placeholders: `?` posicional, na ORDEM em que aparecem no SQL (ano primeiro,
  // depois mês). Não troque por `$1`/`$2`: o SQLite numera parâmetros nomeados
  // pela ordem de aparição, então um `$2` escrito antes do `$1` recebe o
  // primeiro valor da lista — e o filtro passa a comparar ano com mês.
  const existentes = await sqlite.select<{ parent_id: string }[]>(
    `SELECT DISTINCT parent_id
       FROM transactions
      WHERE is_template = 0
        AND parent_id IS NOT NULL
        AND COALESCE(
              year,
              CAST(strftime('%Y', COALESCE(date, due_date)) AS INTEGER)
            ) = ?
        AND COALESCE(
              month,
              CAST(strftime('%m', COALESCE(date, due_date)) AS INTEGER)
            ) = ?`,
    [ano, mes]
  );
  const jaMaterializados = new Set(existentes.map((r) => r.parent_id));

  const competencia = competenciaEmNumero(mes, ano);
  const ts = agora();
  let criadas = 0;

  for (const modelo of modelos) {
    if (jaMaterializados.has(modelo.id)) continue;

    const tipoOcorrencia = TIPO_DA_OCORRENCIA[modelo.type];
    if (!tipoOcorrencia) continue;

    // Regra encerrada (dívida quitada, cadastro cancelado) não gera mais nada.
    if (STATUS_ENCERRADOS.has(modelo.status)) continue;

    // Nunca retroage: nada antes da competência em que o modelo foi cadastrado.
    const criacao = competenciaDeCriacao(modelo.created_at);
    if (criacao !== null && competencia < criacao) continue;

    // Respeita a vigência declarada no cadastro (início/fim), quando houver.
    if (!estaVigemNoMes(modelo.start_date, modelo.end_date, mes, ano)) continue;

    // Dívidas: só enquanto sobrar parcela.
    let numeroParcela: number | null = null;
    if (modelo.type === "DEBT") {
      if ((modelo.dbt_remaining_installments ?? 0) <= 0) continue;

      numeroParcela = (await contarParcelasGeradas(modelo.id)) + 1;
      const total = modelo.dbt_total_installments;
      if (total !== null && numeroParcela > total) continue;
    }

    const vencimento = dataDeVencimento(modelo, mes, ano);

    await sqlite.execute(
      `INSERT INTO transactions
         (id, type, status, description, amount_cents, due_date, date, month, year,
          account_id, credit_card_id, category_id, persona_id, parent_id,
          is_template, is_recurring, dbt_installment_number, source,
          created_at, updated_at)
       VALUES (?, ?, 'PREVISTO', ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?,
               0, 0, ?, 'MANUAL',
               ?, ?)`,
      [
        `oco_${crypto.randomUUID()}`,
        tipoOcorrencia,
        modelo.description,
        modelo.amount_cents,
        vencimento,
        vencimento,
        mes,
        ano,
        modelo.account_id,
        modelo.credit_card_id,
        modelo.category_id,
        modelo.persona_id,
        modelo.id,
        numeroParcela,
        ts,
        ts,
      ]
    );
    criadas++;
  }

  return criadas;
}

/**
 * Apaga ocorrências cujo modelo não existe mais (o usuário excluiu a receita, o
 * custo fixo ou a dívida). Remove SÓ o que ainda estava previsto e foi gerado
 * por este motor:
 *   • nada confirmado/pago pelo usuário é tocado;
 *   • nada vindo da Pluggy é tocado (source = 'PLUGGY');
 *   • nada avulso é tocado (ocorrência gerada sempre tem parent_id).
 *
 * @returns quantas linhas foram removidas.
 */
export async function removerOcorrenciasOrfas(): Promise<number> {
  const sqlite = await getSqlite();
  const resultado = await sqlite.execute(
    `DELETE FROM transactions
      WHERE is_template = 0
        AND status = 'PREVISTO'
        AND source = 'MANUAL'
        AND parent_id IS NOT NULL
        AND type IN ('INCOME', 'SALARY', 'LIVING_COST', 'DEBT_INSTALLMENT')
        AND NOT EXISTS (
              SELECT 1 FROM transactions m
               WHERE m.id = transactions.parent_id
            )`
  );
  return resultado.rowsAffected ?? 0;
}
