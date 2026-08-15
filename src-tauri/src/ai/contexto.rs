//! Contexto financeiro compacto enviado ao modelo.
//!
//! Princípio P8: a IA é a voz, não a calculadora. Ela nunca recebe o banco
//! inteiro nem é convidada a recalcular nada — recebe um resumo curto, já
//! somado aqui, e apenas narra esses números.
//!
//! Por que o contexto é montado no Rust (e não recebido pronto do frontend):
//!   1. As permissões (`ai_can_read_monthly`, `ai_can_use_life_context`) moram
//!      na MESMA linha de `integrations` de onde sai a chave. Montar aqui deixa
//!      a permissão e o segredo no mesmo lugar — a UI não tem como burlar o
//!      flag mandando um contexto mais gordo do que o autorizado.
//!   2. As regras de soma (fatura agregada da Pluggy, transferência, template)
//!      são sutis e já existem em `src/core/db/mes.ts`. Duplicá-las no frontend
//!      só para alimentar a IA multiplicaria o risco de divergência; aqui elas
//!      ficam num único lugar, ao lado da leitura.
//!
//! Armadilhas respeitadas em todas as somas:
//!   • `is_template = 0` — só movimento real, nunca a regra cadastrada.
//!   • `INVOICE` com `source = 'PLUGGY'` é a SOMA dos `EXPENSE` do cartão na
//!     competência; somar os dois contaria o mesmo dinheiro duas vezes. Fatura
//!     com outra origem conta normalmente (não há `EXPENSE` por trás dela).
//!   • `TRANSFER` é dinheiro trocando de bolso — não é gasto nem receita.

use rusqlite::Connection;

use crate::errors::AppError;

/// O que o usuário autorizou a IA a enxergar (colunas `ai_*` de `integrations`).
#[derive(Debug, Clone, Copy)]
pub struct Permissoes {
    /// `ai_can_read_monthly` — movimento da competência: totais, gastos por
    /// categoria e faturas em aberto.
    pub ler_mes: bool,
    /// `ai_can_use_life_context` — retrato estrutural: saldo das contas, custo
    /// de vida fixo, dívidas e metas.
    pub usar_contexto_de_vida: bool,
}

impl Permissoes {
    pub fn nenhuma(&self) -> bool {
        !self.ler_mes && !self.usar_contexto_de_vida
    }
}

/// Statuses que representam dinheiro que de fato circulou.
const STATUS_CONFIRMADOS: &str = "('CONFIRMADO', 'PAGO')";

/// Filtro de competência: `month`/`year` mandam; em branco, cai para o mês/ano
/// de `date` ou `due_date`. `?1` = mês, `?2` = ano.
const FILTRO_COMPETENCIA: &str = "
    AND COALESCE(t.year,  CAST(strftime('%Y', COALESCE(t.date, t.due_date)) AS INTEGER)) = ?2
    AND COALESCE(t.month, CAST(strftime('%m', COALESCE(t.date, t.due_date)) AS INTEGER)) = ?1";

/// Formata centavos em reais no padrão brasileiro. Ex.: 184700 → "R$ 1.847,00".
pub fn formatar_brl(centavos: i64) -> String {
    let sinal = if centavos < 0 { "-" } else { "" };
    let absoluto = centavos.unsigned_abs();
    let reais = absoluto / 100;
    let restante = absoluto % 100;

    let mut inteiro = reais.to_string();
    let mut agrupado = String::new();
    while inteiro.len() > 3 {
        let corte = inteiro.len() - 3;
        agrupado = format!(".{}{}", &inteiro[corte..], agrupado);
        inteiro.truncate(corte);
    }

    format!("{sinal}R$ {inteiro}{agrupado},{restante:02}")
}

/// Monta o resumo financeiro em texto. Devolve `None` quando o usuário não
/// autorizou nenhum acesso — nesse caso a IA responde só com conhecimento geral.
pub fn montar(
    conn: &Connection,
    mes: i32,
    ano: i32,
    permissoes: Permissoes,
) -> Result<Option<String>, AppError> {
    if permissoes.nenhuma() {
        return Ok(None);
    }

    let mut blocos: Vec<String> = Vec::new();

    if permissoes.ler_mes {
        blocos.push(bloco_resumo_do_mes(conn, mes, ano)?);
        if let Some(b) = bloco_gastos_por_categoria(conn, mes, ano)? {
            blocos.push(b);
        }
        if let Some(b) = bloco_faturas_em_aberto(conn)? {
            blocos.push(b);
        }
    }

    if permissoes.usar_contexto_de_vida {
        if let Some(b) = bloco_contas(conn)? {
            blocos.push(b);
        }
        if let Some(b) = bloco_custo_de_vida(conn)? {
            blocos.push(b);
        }
        if let Some(b) = bloco_dividas(conn)? {
            blocos.push(b);
        }
        if let Some(b) = bloco_metas(conn)? {
            blocos.push(b);
        }
    }

    Ok(Some(blocos.join("\n\n")))
}

// ─── Movimento da competência ─────────────────────────────────────────────────

fn bloco_resumo_do_mes(conn: &Connection, mes: i32, ano: i32) -> Result<String, AppError> {
    let sql = format!(
        "SELECT
             COALESCE(SUM(CASE WHEN t.type IN ('INCOME', 'SALARY')
                               THEN t.amount_cents ELSE 0 END), 0) AS entrou,
             COALESCE(SUM(CASE WHEN t.type IN ('EXPENSE', 'LIVING_COST', 'DEBT_INSTALLMENT')
                                 OR (t.type = 'INVOICE' AND t.source <> 'PLUGGY')
                               THEN t.amount_cents ELSE 0 END), 0) AS saiu,
             COUNT(*) AS total
           FROM transactions t
          WHERE t.is_template = 0
            AND t.status IN {STATUS_CONFIRMADOS}
            AND (
                  t.type IN ('INCOME', 'SALARY', 'EXPENSE', 'LIVING_COST', 'DEBT_INSTALLMENT')
                  OR (t.type = 'INVOICE' AND t.source <> 'PLUGGY')
                ){FILTRO_COMPETENCIA}"
    );

    let (entrou, saiu, total): (i64, i64, i64) =
        conn.query_row(&sql, rusqlite::params![mes, ano], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        })?;

    Ok(format!(
        "## Competência {mes:02}/{ano}\n\
         - Entrou: {}\n\
         - Saiu: {}\n\
         - Sobra do mês: {}\n\
         - Movimentos confirmados: {total}",
        formatar_brl(entrou),
        formatar_brl(saiu),
        formatar_brl(entrou - saiu),
    ))
}

fn bloco_gastos_por_categoria(
    conn: &Connection,
    mes: i32,
    ano: i32,
) -> Result<Option<String>, AppError> {
    let sql = format!(
        "SELECT COALESCE(c.name, 'Sem categoria') AS categoria,
                COALESCE(SUM(t.amount_cents), 0) AS total
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.is_template = 0
            AND t.status IN {STATUS_CONFIRMADOS}
            AND (
                  t.type IN ('EXPENSE', 'LIVING_COST', 'DEBT_INSTALLMENT')
                  OR (t.type = 'INVOICE' AND t.source <> 'PLUGGY')
                ){FILTRO_COMPETENCIA}
          GROUP BY categoria
          HAVING total > 0
          ORDER BY total DESC
          LIMIT 8"
    );

    let mut stmt = conn.prepare(&sql)?;
    let linhas: Vec<(String, i64)> = stmt
        .query_map(rusqlite::params![mes, ano], |r| Ok((r.get(0)?, r.get(1)?)))?
        .filter_map(|r| r.ok())
        .collect();

    if linhas.is_empty() {
        return Ok(None);
    }

    let itens = linhas
        .into_iter()
        .map(|(nome, total)| format!("- {nome}: {}", formatar_brl(total)))
        .collect::<Vec<_>>()
        .join("\n");

    Ok(Some(format!(
        "## Gastos por categoria em {mes:02}/{ano} (maiores primeiro)\n{itens}"
    )))
}

fn bloco_faturas_em_aberto(conn: &Connection) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT COALESCE(cc.name, 'Cartão'),
                COALESCE(t.amount_cents, 0),
                COALESCE(t.due_date, '')
           FROM transactions t
           LEFT JOIN credit_cards cc ON cc.id = t.credit_card_id
          WHERE t.type = 'INVOICE'
            AND t.is_template = 0
            AND t.status NOT IN ('PAGO', 'CANCELADO')
            AND COALESCE(t.amount_cents, 0) > 0
          ORDER BY t.due_date
          LIMIT 6",
    )?;

    let linhas: Vec<(String, i64, String)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .filter_map(|r| r.ok())
        .collect();

    if linhas.is_empty() {
        return Ok(None);
    }

    let itens = linhas
        .into_iter()
        .map(|(cartao, valor, venc)| {
            let quando = if venc.is_empty() {
                String::new()
            } else {
                format!(" (vence em {venc})")
            };
            format!("- {cartao}: {}{quando}", formatar_brl(valor))
        })
        .collect::<Vec<_>>()
        .join("\n");

    Ok(Some(format!("## Faturas de cartão em aberto\n{itens}")))
}

// ─── Contexto de vida ─────────────────────────────────────────────────────────

fn bloco_contas(conn: &Connection) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT name, COALESCE(balance_cents, 0)
           FROM accounts
          WHERE archived = 0 AND is_active = 1
          ORDER BY balance_cents DESC
          LIMIT 10",
    )?;

    let linhas: Vec<(String, i64)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .filter_map(|r| r.ok())
        .collect();

    if linhas.is_empty() {
        return Ok(None);
    }

    let total: i64 = linhas.iter().map(|(_, saldo)| saldo).sum();
    let itens = linhas
        .into_iter()
        .map(|(nome, saldo)| format!("- {nome}: {}", formatar_brl(saldo)))
        .collect::<Vec<_>>()
        .join("\n");

    Ok(Some(format!(
        "## Saldo das contas\n{itens}\n- Total somado: {}",
        formatar_brl(total)
    )))
}

fn bloco_custo_de_vida(conn: &Connection) -> Result<Option<String>, AppError> {
    // Aqui SIM lemos templates: a pergunta é "quanto custa viver por mês",
    // que é justamente a regra cadastrada, não a ocorrência do mês.
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount_cents), 0)
           FROM transactions
          WHERE type = 'LIVING_COST'
            AND is_template = 1
            AND status <> 'CANCELADO'",
        [],
        |r| r.get(0),
    )?;

    if total == 0 {
        return Ok(None);
    }

    Ok(Some(format!(
        "## Custo de vida fixo cadastrado\n- Total mensal: {}",
        formatar_brl(total)
    )))
}

fn bloco_dividas(conn: &Connection) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT description,
                COALESCE(dbt_total_cents, 0),
                COALESCE(dbt_remaining_installments, 0)
           FROM transactions
          WHERE type = 'DEBT'
            AND is_template = 1
            AND status NOT IN ('CONCLUIDO', 'CANCELADO')
          ORDER BY dbt_total_cents DESC
          LIMIT 6",
    )?;

    let linhas: Vec<(String, i64, i64)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .filter_map(|r| r.ok())
        .collect();

    if linhas.is_empty() {
        return Ok(None);
    }

    let itens = linhas
        .into_iter()
        .map(|(desc, total, restantes)| {
            format!(
                "- {desc}: {} · {restantes} parcela(s) restante(s)",
                formatar_brl(total)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    Ok(Some(format!("## Dívidas em aberto\n{itens}")))
}

fn bloco_metas(conn: &Connection) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT name,
                COALESCE(target_amount_cents, 0),
                COALESCE(current_amount_cents, 0)
           FROM goals
          WHERE status = 'IN_PROGRESS'
          ORDER BY target_amount_cents DESC
          LIMIT 5",
    )?;

    let linhas: Vec<(String, i64, i64)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .filter_map(|r| r.ok())
        .collect();

    if linhas.is_empty() {
        return Ok(None);
    }

    let itens = linhas
        .into_iter()
        .map(|(nome, alvo, atual)| {
            format!(
                "- {nome}: {} de {}",
                formatar_brl(atual),
                formatar_brl(alvo)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    Ok(Some(format!("## Metas em progresso\n{itens}")))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn formata_valores_em_reais() {
        assert_eq!(formatar_brl(0), "R$ 0,00");
        assert_eq!(formatar_brl(5), "R$ 0,05");
        assert_eq!(formatar_brl(184700), "R$ 1.847,00");
        assert_eq!(formatar_brl(100000000), "R$ 1.000.000,00");
        assert_eq!(formatar_brl(-2599), "-R$ 25,99");
    }

    /// Guarda as duas armadilhas de soma: fatura agregada da Pluggy e
    /// transferência não podem entrar no "saiu" do mês.
    #[test]
    fn resumo_ignora_fatura_pluggy_e_transferencia() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE transactions (
                 id TEXT PRIMARY KEY,
                 type TEXT NOT NULL,
                 status TEXT NOT NULL,
                 description TEXT NOT NULL,
                 amount_cents INTEGER,
                 due_date TEXT,
                 date TEXT,
                 month INTEGER,
                 year INTEGER,
                 category_id TEXT,
                 credit_card_id TEXT,
                 is_template INTEGER NOT NULL DEFAULT 0,
                 source TEXT NOT NULL DEFAULT 'MANUAL'
             );",
        )
        .unwrap();

        let inserir = |id: &str, tipo: &str, valor: i64, origem: &str, template: i32| {
            conn.execute(
                "INSERT INTO transactions
                     (id, type, status, description, amount_cents, month, year, is_template, source)
                 VALUES (?1, ?2, 'CONFIRMADO', ?1, ?3, 3, 2026, ?5, ?4)",
                rusqlite::params![id, tipo, valor, origem, template],
            )
            .unwrap();
        };

        inserir("a", "SALARY", 500_000, "MANUAL", 0);
        inserir("b", "EXPENSE", 30_000, "PLUGGY", 0);
        // Fatura agregada da Pluggy: é a soma do EXPENSE acima, não pode somar.
        inserir("c", "INVOICE", 30_000, "PLUGGY", 0);
        // Transferência entre bolsos: nem entrada nem saída.
        inserir("d", "TRANSFER", 90_000, "MANUAL", 0);
        // Regra cadastrada (template): não é movimento real.
        inserir("e", "LIVING_COST", 120_000, "MANUAL", 1);
        // Fatura manual: não tem EXPENSE por trás, conta normalmente.
        inserir("f", "INVOICE", 10_000, "MANUAL", 0);

        let bloco = bloco_resumo_do_mes(&conn, 3, 2026).unwrap();
        assert!(bloco.contains("Entrou: R$ 5.000,00"), "{bloco}");
        assert!(bloco.contains("Saiu: R$ 400,00"), "{bloco}");
        assert!(bloco.contains("Sobra do mês: R$ 4.600,00"), "{bloco}");
    }
}
