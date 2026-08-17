/**
 * Consulta pública de CNPJ (BrasilAPI, espelho dos dados abertos da RFB).
 *
 * O Rust só faz a requisição e traduz os códigos HTTP em mensagens — ver
 * `src-tauri/src/commands/cnpj.rs`. Todo o mapeamento para os campos da
 * empresa acontece aqui, em função pura, para poder ser testado sem rede.
 *
 * Nada é gravado automaticamente: a tela mostra o que veio, o usuário
 * confirma. Dado da Receita pode estar desatualizado (o dump é mensal) e o
 * cadastro do escritório costuma ser mais fiel que o oficial.
 */

import { invoke } from "@tauri-apps/api/core";
import { classificarCnae, formatarCnae, type EnquadramentoCnae } from "@/consts/cnae";
import type { RegimeTributario } from "@/core/db/empresas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SocioReceita = {
  nome: string;
  /** Vem mascarado pela Receita (ex.: "***456789**") — não serve para cadastrar. */
  cpfCnpjMascarado: string | null;
  qualificacao: string | null;
};

export type DadosCnpj = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  /** ISO YYYY-MM-DD */
  dataAbertura: string | null;
  /** Máscara oficial 9999-9/99. */
  cnaePrincipal: string | null;
  cnaeDescricao: string | null;
  cnaesSecundarios: string[];
  uf: string | null;
  municipio: string | null;
  telefone: string | null;
  email: string | null;
  capitalSocialCents: number;
  /** ATIVA | BAIXADA | SUSPENSA | INAPTA | NULA — como a Receita escreve. */
  situacaoCadastral: string | null;
  /**
   * Regime deduzido da opção pelo Simples/MEI. Null quando a Receita não
   * informa: aí é Presumido ou Real, e só o contador sabe qual.
   */
  regimeSugerido: RegimeTributario | null;
  /** Enquadramento derivado do CNAE principal, ou null se não classificado. */
  enquadramento: EnquadramentoCnae | null;
  socios: SocioReceita[];
};

// ─── Interpretação da resposta ────────────────────────────────────────────────

type Json = Record<string, unknown>;

function texto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function digitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** "4532251234" → "(45) 3225-1234"; celular com 11 dígitos vira "(45) 98888-7777". */
export function formatarTelefone(bruto: unknown): string | null {
  const d = digitos(bruto);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  const corte = resto.length - 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/**
 * Reais → centavos. A Receita manda `capital_social` como número decimal; o
 * app inteiro trabalha em centavos, e `* 100` sem arredondar deixa resíduo de
 * ponto flutuante (1234.56 * 100 = 123455.99999999999).
 */
function reaisParaCentavos(v: unknown): number {
  const n = typeof v === "number" ? v : Number(texto(v) ?? "");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function regimeDaOpcao(json: Json): RegimeTributario | null {
  if (json.opcao_pelo_mei === true) return "MEI";
  if (json.opcao_pelo_simples === true) return "SIMPLES";
  return null;
}

function mapearSocios(v: unknown): SocioReceita[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const s = item as Json;
    const nome = texto(s.nome_socio);
    if (!nome) return [];
    return [
      {
        nome,
        cpfCnpjMascarado: texto(s.cnpj_cpf_do_socio),
        qualificacao: texto(s.qualificacao_socio),
      },
    ];
  });
}

function mapearCnaesSecundarios(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const c = formatarCnae((item as Json).codigo as string | number);
    return c ? [c] : [];
  });
}

/**
 * Converte o JSON cru da BrasilAPI nos campos da empresa.
 *
 * Tolerante de propósito: campo ausente vira null em vez de estourar. O
 * cadastro segue utilizável mesmo quando a Receita devolve registro
 * incompleto, o que acontece com empresa recém-aberta.
 */
export function interpretarRespostaCnpj(bruto: string): DadosCnpj {
  let json: Json;
  try {
    json = JSON.parse(bruto) as Json;
  } catch {
    throw new Error("A Receita devolveu uma resposta ilegível.");
  }

  const razaoSocial = texto(json.razao_social);
  if (!razaoSocial) {
    throw new Error("A resposta da Receita veio sem razão social.");
  }

  const cnaePrincipal = formatarCnae(json.cnae_fiscal as string | number);

  return {
    cnpj: digitos(json.cnpj),
    razaoSocial,
    nomeFantasia: texto(json.nome_fantasia),
    dataAbertura: texto(json.data_inicio_atividade),
    cnaePrincipal,
    cnaeDescricao: texto(json.cnae_fiscal_descricao),
    cnaesSecundarios: mapearCnaesSecundarios(json.cnaes_secundarios),
    uf: texto(json.uf)?.toUpperCase() ?? null,
    municipio: texto(json.municipio),
    telefone: formatarTelefone(json.ddd_telefone_1),
    email: texto(json.email),
    capitalSocialCents: reaisParaCentavos(json.capital_social),
    situacaoCadastral: texto(json.descricao_situacao_cadastral)?.toUpperCase() ?? null,
    regimeSugerido: regimeDaOpcao(json),
    enquadramento: classificarCnae(cnaePrincipal),
    socios: mapearSocios(json.qsa),
  };
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

/** Consulta o CNPJ na Receita. Lança com mensagem pronta para a tela. */
export async function consultarCnpj(cnpj: string): Promise<DadosCnpj> {
  const bruto = await invoke<string>("consultar_cnpj", { cnpj });
  return interpretarRespostaCnpj(bruto);
}
