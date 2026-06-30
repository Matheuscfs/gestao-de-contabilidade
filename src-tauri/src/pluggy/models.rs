use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─── Autenticação ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CredenciaisPluggy {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RespostaAuth {
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RespostaConnectToken {
    pub access_token: String,
}

// ─── Paginação ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Paginado<T> {
    pub results: Vec<T>,
    pub total: u32,
    pub page: u32,
    pub total_pages: u32,
}

// ─── Item ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StatusItem {
    Updating,
    Updated,
    LoginError,
    Outdated,
    WaitingUserInput,
    #[serde(other)]
    Desconhecido,
}

impl std::fmt::Display for StatusItem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            StatusItem::Updating         => "UPDATING",
            StatusItem::Updated          => "UPDATED",
            StatusItem::LoginError       => "LOGIN_ERROR",
            StatusItem::Outdated         => "OUTDATED",
            StatusItem::WaitingUserInput => "WAITING_USER_INPUT",
            StatusItem::Desconhecido     => "UNKNOWN",
        };
        write!(f, "{s}")
    }
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StatusExecucao {
    Success,
    PartialSuccess,
    InvalidCredentials,
    SiteNotAvailable,
    AccountLocked,
    AccountNeedsAction,
    ConnectionError,
    #[serde(other)]
    Desconhecido,
}

impl std::fmt::Display for StatusExecucao {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            StatusExecucao::Success              => "SUCCESS",
            StatusExecucao::PartialSuccess       => "PARTIAL_SUCCESS",
            StatusExecucao::InvalidCredentials   => "INVALID_CREDENTIALS",
            StatusExecucao::SiteNotAvailable     => "SITE_NOT_AVAILABLE",
            StatusExecucao::AccountLocked        => "ACCOUNT_LOCKED",
            StatusExecucao::AccountNeedsAction   => "ACCOUNT_NEEDS_ACTION",
            StatusExecucao::ConnectionError      => "CONNECTION_ERROR",
            StatusExecucao::Desconhecido         => "UNKNOWN",
        };
        write!(f, "{s}")
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub status: StatusItem,
    #[serde(default)]
    pub execution_status: Option<StatusExecucao>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub last_updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub next_auto_sync_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub error: Option<ErroItem>,
    #[serde(default)]
    pub connector: Option<Connector>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ErroItem {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Connector {
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub institution_id: Option<String>,
    #[serde(rename = "type", default)]
    pub tipo: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
}

// ─── Account ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TipoConta {
    Bank,
    Credit,
    #[serde(other)]
    Outro,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SubtipoConta {
    CheckingAccount,
    SavingsAccount,
    CreditCard,
    Investment,
    #[serde(other)]
    Outro,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub item_id: String,
    #[serde(rename = "type")]
    pub tipo: TipoConta,
    pub subtype: SubtipoConta,
    #[serde(default)]
    pub number: Option<String>,
    pub name: String,
    /// Valor decimal — converter para centavos no mapper.
    pub balance: f64,
    #[serde(default = "default_brl")]
    pub currency_code: String,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub tax_number: Option<String>,
    /// Dados de cartão de crédito (presente apenas quando subtype = CREDIT_CARD).
    #[serde(default)]
    pub credit_data: Option<CreditData>,
}

fn default_brl() -> String {
    "BRL".into()
}

/// Bloco `creditData` de uma conta de cartão (limite, bandeira, vencimento).
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreditData {
    #[serde(default)]
    pub brand: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    /// Limite total do cartão (decimal — converter para centavos).
    #[serde(default)]
    pub credit_limit: Option<f64>,
    #[serde(default)]
    pub available_credit_limit: Option<f64>,
    /// Data de vencimento da fatura atual ("YYYY-MM-DD").
    #[serde(default)]
    pub balance_due_date: Option<String>,
    /// Data de fechamento da fatura atual ("YYYY-MM-DD"), quando disponível.
    #[serde(default)]
    pub balance_close_date: Option<String>,
    #[serde(default)]
    pub minimum_payment: Option<f64>,
}

// ─── Transaction ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TipoTransacao {
    Debit,
    Credit,
    #[serde(other)]
    Outro,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StatusTransacao {
    Posted,
    Pending,
    #[serde(other)]
    Outro,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub account_id: String,
    pub description: String,
    /// Negativo = saída (DEBIT), positivo = entrada (CREDIT).
    /// Cartão: positivo = gasto (aumenta fatura), negativo = pagamento.
    pub amount: f64,
    pub date: DateTime<Utc>,
    #[serde(default)]
    pub balance: Option<f64>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(rename = "type")]
    pub tipo: TipoTransacao,
    pub status: StatusTransacao,
    #[serde(default = "default_brl")]
    pub currency_code: String,
    #[serde(default)]
    pub provider_code: Option<String>,
    #[serde(default)]
    pub payment_data: Option<DadosPagamento>,
    #[serde(default)]
    pub merchant: Option<Merchant>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DadosPagamento {
    #[serde(default)]
    pub payer: Option<EntidadePagamento>,
    #[serde(default)]
    pub receiver: Option<EntidadePagamento>,
    #[serde(default)]
    pub payment_method: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EntidadePagamento {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub branch_number: Option<String>,
    #[serde(default)]
    pub account_number: Option<String>,
    #[serde(default)]
    pub tax_number: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Merchant {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub business_name: Option<String>,
    #[serde(default)]
    pub cnpj: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
}

// ─── Investment ───────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TipoInvestimento {
    FixedIncome,
    Equity,
    MutualFund,
    Security,
    Cryptocurrency,
    #[serde(other)]
    Outro,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StatusInvestimento {
    Active,
    Pending,
    Redeemed,
    TotalWithdrawal,
    #[serde(other)]
    Outro,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Investment {
    pub id: String,
    pub item_id: String,
    pub name: String,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(rename = "type")]
    pub tipo: TipoInvestimento,
    #[serde(default)]
    pub subtype: Option<String>,
    /// Valor atual (pode ser null em alguns conectores) — converter para centavos no mapper.
    #[serde(default)]
    pub balance: Option<f64>,
    /// Valor investido — pode ser null em alguns conectores.
    #[serde(default)]
    pub amount: Option<f64>,
    /// Lucro acumulado — opcional conforme doc.
    #[serde(default)]
    pub amount_profit: Option<f64>,
    #[serde(default)]
    pub annual_rate: Option<f64>,
    #[serde(default)]
    pub rate_type: Option<String>,
    #[serde(default)]
    pub due_date: Option<DateTime<Utc>>,
    /// Status é opcional na API (pode ser null).
    #[serde(default)]
    pub status: Option<StatusInvestimento>,
    #[serde(default = "default_brl")]
    pub currency_code: String,
}

// ─── Identity ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub id: String,
    pub item_id: String,
    #[serde(default)]
    pub full_name: Option<String>,
    #[serde(default)]
    pub document: Option<String>,
    #[serde(default)]
    pub document_type: Option<String>,
    #[serde(default)]
    pub birth_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub emails: Vec<ContatoEmail>,
    #[serde(default)]
    pub phone_numbers: Vec<ContatoFone>,
    #[serde(default)]
    pub addresses: Vec<Endereco>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContatoEmail {
    #[serde(rename = "type")]
    pub tipo: String,
    pub value: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContatoFone {
    #[serde(rename = "type")]
    pub tipo: String,
    pub value: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Endereco {
    #[serde(default)]
    pub full_address: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub postal_code: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
}

// ─── Loan ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Loan {
    pub id: String,
    pub item_id: String,
    #[serde(rename = "type", default)]
    pub tipo: Option<String>,
    #[serde(default)]
    pub date: Option<DateTime<Utc>>,
    /// Valor original do contrato — converter para centavos.
    pub contracted_amount: f64,
    /// Saldo devedor atual — converter para centavos.
    pub outstanding_balance: f64,
    /// Valor da parcela — converter para centavos.
    #[serde(default)]
    pub installment_value: Option<f64>,
    #[serde(default)]
    pub total_installments: Option<i32>,
    #[serde(default)]
    pub paid_installments: Option<i32>,
    #[serde(default)]
    pub due_date: Option<DateTime<Utc>>,
    #[serde(default = "default_brl")]
    pub currency_code: String,
}

// ─── Intelligence ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PagamentoRecorrente {
    pub id: String,
    pub account_id: String,
    pub description: String,
    /// Valor recorrente (decimal) — converter para centavos.
    pub amount: f64,
    #[serde(default)]
    pub frequency: Option<String>,
    #[serde(rename = "type", default)]
    pub tipo: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub last_transaction: Option<DateTime<Utc>>,
    #[serde(default)]
    pub next_transaction: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransacaoEnriquecida {
    pub id: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub merchant: Option<Merchant>,
}
