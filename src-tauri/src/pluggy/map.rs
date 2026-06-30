use chrono::Utc;
use serde::Serialize;

use super::models::{Account, Investment, SubtipoConta, TipoConta, TipoInvestimento, TipoTransacao, Transaction};

// ─── Conversão monetária ──────────────────────────────────────────────────────

/// Converte valor decimal da Pluggy (ex: -55.90) para centavos inteiros.
/// Regra: × 100 com arredondamento, sem float no resultado.
pub fn decimal_para_centavos(valor: f64) -> i64 {
    (valor * 100.0).round() as i64
}

// ─── Parâmetros de inserção ───────────────────────────────────────────────────

/// Dados necessários para inserir/atualizar um lançamento importado da Pluggy.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryImportado {
    pub id: String,
    pub pluggy_transaction_id: String,
    pub description: String,
    /// Em centavos inteiros, sempre positivo. O tipo (INCOME/EXPENSE) carrega o sinal.
    pub amount_cents: i64,
    pub tipo: TipoEntrada,
    /// "CONFIRMADO" — transações importadas já ocorreram.
    pub status: &'static str,
    pub date: String,
    pub month: i32,
    pub year: i32,
    pub account_id: Option<String>,
    pub credit_card_id: Option<String>,
    pub category_pluggy: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TipoEntrada {
    Income,
    Expense,
}

impl TipoEntrada {
    pub fn to_str(&self) -> &'static str {
        match self {
            TipoEntrada::Income  => "INCOME",
            TipoEntrada::Expense => "EXPENSE",
        }
    }
}

/// Parâmetros para criação/atualização de uma conta vinda da Pluggy.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContaImportada {
    pub pluggy_account_id: String,
    pub name: String,
    pub tipo: TipoContaQuibo,
    pub balance_cents: i64,
    pub bank: Option<String>,
    pub account_number: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TipoContaQuibo {
    Checking,
    Savings,
    Investment,
    Other,
}

/// Parâmetros para criar/atualizar um investimento importado da Pluggy.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvestimentoImportado {
    pub pluggy_investment_id: String,
    pub name: String,
    pub tipo: TipoInvestimentoQuibo,
    pub ticker: Option<String>,
    pub balance_cents: i64,
    pub purchase_price_cents: i64,
    pub profit_cents: i64,
    pub annual_rate: Option<f64>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TipoInvestimentoQuibo {
    FixedIncome,
    Stock,
    Etf,
    Pension,
    Other,
}

impl TipoInvestimentoQuibo {
    pub fn to_str(&self) -> &'static str {
        match self {
            TipoInvestimentoQuibo::FixedIncome => "FIXED_INCOME",
            TipoInvestimentoQuibo::Stock       => "STOCK",
            TipoInvestimentoQuibo::Etf         => "ETF",
            TipoInvestimentoQuibo::Pension     => "PENSION",
            TipoInvestimentoQuibo::Other       => "OTHER",
        }
    }
}

// ─── Mapeamento Transaction → EntryImportado ─────────────────────────────────

/// Converte uma Transaction da Pluggy em parâmetros de inserção para `entries`.
///
/// Regras de sinal (doc 03 §11):
/// - Conta bancária: amount < 0 → EXPENSE, amount > 0 → INCOME
/// - Cartão de crédito: amount > 0 → EXPENSE (gasto), amount < 0 → INCOME (pagamento)
pub fn transacao_para_entry(
    tx: &Transaction,
    account_id_quibo: Option<&str>,
    credit_card_id_quibo: Option<&str>,
    e_conta_credito: bool,
) -> EntryImportado {
    let tipo = resolver_tipo_entrada(tx, e_conta_credito);
    let amount_cents = decimal_para_centavos(tx.amount.abs());

    let data_str = tx.date.format("%Y-%m-%d").to_string();
    let mes = tx.date.format("%m").to_string().parse::<i32>().unwrap_or(1);
    let ano = tx.date.format("%Y").to_string().parse::<i32>().unwrap_or(2025);

    let agora = Utc::now().to_rfc3339();

    EntryImportado {
        id: uuid_novo(),
        pluggy_transaction_id: tx.id.clone(),
        description: tx.description.clone(),
        amount_cents,
        tipo,
        status: "CONFIRMADO",
        date: data_str,
        month: mes,
        year: ano,
        account_id: account_id_quibo.map(String::from),
        credit_card_id: credit_card_id_quibo.map(String::from),
        category_pluggy: tx.category.clone(),
        created_at: agora.clone(),
        updated_at: agora,
    }
}

fn resolver_tipo_entrada(tx: &Transaction, e_conta_credito: bool) -> TipoEntrada {
    if e_conta_credito {
        // Cartão: positivo = gasto, negativo = pagamento de fatura
        if tx.amount >= 0.0 {
            TipoEntrada::Expense
        } else {
            TipoEntrada::Income
        }
    } else {
        // Conta bancária: negativo = saída, positivo = entrada
        match tx.tipo {
            TipoTransacao::Debit => TipoEntrada::Expense,
            TipoTransacao::Credit => TipoEntrada::Income,
            TipoTransacao::Outro => {
                if tx.amount < 0.0 { TipoEntrada::Expense } else { TipoEntrada::Income }
            }
        }
    }
}

// ─── Mapeamento Account → ContaImportada ─────────────────────────────────────

pub fn conta_pluggy_para_quibo(account: &Account, nome_banco: Option<&str>) -> ContaImportada {
    let tipo = match (&account.tipo, &account.subtype) {
        (TipoConta::Bank, SubtipoConta::CheckingAccount) => TipoContaQuibo::Checking,
        (TipoConta::Bank, SubtipoConta::SavingsAccount)  => TipoContaQuibo::Savings,
        (TipoConta::Bank, SubtipoConta::Investment)       => TipoContaQuibo::Investment,
        _                                                  => TipoContaQuibo::Other,
    };

    ContaImportada {
        pluggy_account_id: account.id.clone(),
        name: account.name.clone(),
        tipo,
        balance_cents: decimal_para_centavos(account.balance),
        bank: nome_banco.map(String::from),
        account_number: account.number.clone(),
    }
}

// ─── Mapeamento Investment → InvestimentoImportado ────────────────────────────

pub fn investimento_pluggy_para_quibo(inv: &Investment) -> InvestimentoImportado {
    let tipo = match inv.tipo {
        TipoInvestimento::FixedIncome  => TipoInvestimentoQuibo::FixedIncome,
        TipoInvestimento::Equity       => TipoInvestimentoQuibo::Stock,
        TipoInvestimento::MutualFund   => TipoInvestimentoQuibo::Etf,
        TipoInvestimento::Security     => TipoInvestimentoQuibo::Pension,
        _                               => TipoInvestimentoQuibo::Other,
    };

    InvestimentoImportado {
        pluggy_investment_id: inv.id.clone(),
        name: inv.name.clone(),
        tipo,
        ticker: inv.code.clone(),
        balance_cents: decimal_para_centavos(inv.balance.unwrap_or(0.0)),
        purchase_price_cents: decimal_para_centavos(inv.amount.unwrap_or(0.0)),
        profit_cents: decimal_para_centavos(inv.amount_profit.unwrap_or(0.0)),
        annual_rate: inv.annual_rate,
        due_date: inv.due_date.map(|d| d.format("%Y-%m-%d").to_string()),
    }
}

/// Verifica se a conta é do tipo cartão de crédito (para lógica de sinal).
pub fn e_cartao_de_credito(account: &Account) -> bool {
    account.tipo == TipoConta::Credit
        || account.subtype == SubtipoConta::CreditCard
}

// ─── Mapeamento de cartão de crédito ──────────────────────────────────────────

/// Dados de cartão derivados do `creditData` da conta Pluggy.
/// `closing_day`/`due_day` são `None` quando a Pluggy não informa as datas —
/// nesse caso o sync preserva o valor já existente (ou aplica um padrão).
#[derive(Debug, Clone)]
pub struct CartaoImportado {
    pub brand: Option<String>,
    pub limit_cents: i64,
    pub closing_day: Option<i32>,
    pub due_day: Option<i32>,
}

pub fn cartao_pluggy_para_quibo(account: &Account) -> CartaoImportado {
    let cd = account.credit_data.as_ref();

    let brand = cd
        .and_then(|c| c.brand.as_deref())
        .map(normalizar_bandeira);

    let limit_cents = cd
        .and_then(|c| c.credit_limit)
        .map(decimal_para_centavos)
        .unwrap_or(0);

    let due_day = cd.and_then(|c| c.balance_due_date.as_deref()).and_then(dia_do_iso);
    let closing_day = cd
        .and_then(|c| c.balance_close_date.as_deref())
        .and_then(dia_do_iso);

    CartaoImportado {
        brand,
        limit_cents,
        closing_day,
        due_day,
    }
}

/// Normaliza a bandeira da Pluggy para as suportadas no Quibo.
fn normalizar_bandeira(b: &str) -> String {
    match b.trim().to_uppercase().as_str() {
        "VISA" => "VISA",
        "MASTERCARD" | "MASTER" => "MASTERCARD",
        "ELO" => "ELO",
        _ => "OTHER",
    }
    .to_string()
}

/// Extrai o dia (1–31) de uma data "YYYY-MM-DD" (ou ISO com hora).
fn dia_do_iso(s: &str) -> Option<i32> {
    let data = s.split('T').next()?;
    let dia = data.split('-').nth(2)?;
    dia.parse::<i32>().ok().filter(|d| (1..=31).contains(d))
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

fn uuid_novo() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    // UUID v4 simples sem dependência extra; para produção usar uuid crate.
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{:032x}", ts)
}
