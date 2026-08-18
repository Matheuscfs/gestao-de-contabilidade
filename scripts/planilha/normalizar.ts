/**
 * Normalizadores da planilha do escritório (PARALEGAL) → domínio do app.
 *
 * Funções puras, sem I/O: a leitura do arquivo e a escrita no banco ficam em
 * `scripts/importar-planilha.ts`. Toda regra de "como esse texto vira esse
 * campo" mora aqui para poder ser testada — a planilha é preenchida à mão e
 * cada coluna tem meia dúzia de grafias.
 */

import type {
  AtividadePresumido,
  RegimeTributario,
  StatusEmpresa,
} from "@/core/db/empresas";

// ─── Texto ────────────────────────────────────────────────────────────────────

/** Só os dígitos de um texto. */
export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Remove acentos (`"Não Emitido"` → `"Nao Emitido"`) para comparar texto livre. */
export function semAcento(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Texto limpo, ou null quando vazio/placeholder (`-`, `?`, espaços). */
export function textoOuNulo(valor: string | null | undefined): string | null {
  const t = (valor ?? "").trim();
  if (!t || t === "-" || t === "?") return null;
  return t;
}

// ─── Documentos ───────────────────────────────────────────────────────────────

/**
 * CNPJ com exatamente 14 dígitos, ou null.
 *
 * A planilha mistura `60.045.629/0001-80`, `58779389000103.` e digitações
 * truncadas como `53.499.9420001-22` (sem a barra) — todas viram os mesmos
 * 14 dígitos. Qualquer coisa fora disso é descartada em vez de "consertada".
 */
export function normalizarCnpj(valor: string): string | null {
  const d = soDigitos(valor);
  return d.length === 14 ? d : null;
}

/**
 * CPF com exatamente 11 dígitos, ou null.
 *
 * Guarda deliberada: a coluna CPF da planilha tem senha (`123*Marcelo`) e CPF
 * incompleto (`36093189-88`) em algumas linhas. Nada disso pode virar CPF.
 */
export function normalizarCpf(valor: string): string | null {
  const d = soDigitos(valor);
  return d.length === 11 ? d : null;
}

// ─── Dinheiro ─────────────────────────────────────────────────────────────────

/**
 * Valor monetário → centavos (inteiro).
 *
 * Aceita número puro do Excel (`113.33333333333333`) e texto em pt-BR
 * (`1.234,56`) ou en-US (`1,234.56`). Retorna null quando não há número.
 */
export function paraCentavos(valor: string | number | null): number | null {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? Math.round(valor * 100) : null;
  }

  let t = valor.trim().replace(/[R$\s]/g, "");
  if (!t) return null;

  const temVirgula = t.includes(",");
  const temPonto = t.includes(".");
  if (temVirgula && temPonto) {
    // O separador decimal é o que aparece por último.
    t =
      t.lastIndexOf(",") > t.lastIndexOf(".")
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
  } else if (temVirgula) {
    t = t.replace(",", ".");
  }

  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

// ─── Datas ────────────────────────────────────────────────────────────────────

/** Data da planilha (Date do Excel ou texto) → ISO `YYYY-MM-DD`, ou null. */
export function paraDataISO(valor: string | Date | null): string | null {
  if (valor == null || valor === "") return null;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    // A data do Excel chega como UTC meia-noite; formatar em UTC evita
    // recuar um dia em fusos negativos (Brasil).
    return valor.toISOString().slice(0, 10);
  }

  const t = valor.trim();
  if (!t) return null;

  // `2025-03-21` ou `2025-03-21 00:00:00`
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // `21/03/2025`
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, d, m, a] = br;
    return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

// ─── Regime, status e atividade ───────────────────────────────────────────────

/**
 * Texto livre de regime → enum do app. Null quando não reconhecido — o
 * chamador decide o padrão, para não inventar regime silenciosamente.
 */
export function normalizarRegime(valor: string): RegimeTributario | null {
  const t = valor.trim().toUpperCase();
  if (!t) return null;
  if (t.includes("MEI")) return "MEI";
  if (t.includes("SIMPLES") || t.includes("SIMEI")) return "SIMPLES";
  if (t.includes("PRESUMIDO")) return "PRESUMIDO";
  if (t.includes("REAL")) return "REAL";
  return null;
}

/**
 * Coluna ATIVA da planilha → status + flag de movimento.
 *
 * "ZERADO" no jargão do escritório é empresa ativa **sem movimento** no
 * período (entrega a obrigação zerada), não um estado de ciclo de vida — por
 * isso vira flag, e não um valor de `status`.
 */
export function normalizarSituacao(valor: string): {
  status: StatusEmpresa;
  semMovimento: boolean;
  /** true quando a planilha marcou `?` — o dado precisa ser conferido. */
  aConferir: boolean;
} {
  const t = valor.trim().toUpperCase();
  if (t === "ZERADO" || t === "ZERADA")
    return { status: "ATIVA", semMovimento: true, aConferir: false };
  if (t === "INATIVA" || t === "INATIVO")
    return { status: "INATIVA", semMovimento: false, aConferir: false };
  if (t === "BAIXADA" || t === "BAIXADO")
    return { status: "BAIXADA", semMovimento: false, aConferir: false };
  if (t === "?" || t === "")
    return { status: "ATIVA", semMovimento: false, aConferir: t === "?" };
  return { status: "ATIVA", semMovimento: false, aConferir: false };
}

/** Presunção do Lucro Presumido a partir do texto da atividade. */
export function normalizarAtividadePresumido(
  valor: string
): AtividadePresumido | null {
  const t = valor.trim().toUpperCase();
  if (!t) return null;
  if (t.includes("TRANSPORTE")) return "TRANSPORTE_PASSAGEIROS";
  if (t.includes("COMERCIO") || t.includes("COMÉRCIO") || t.includes("INDUSTRIA"))
    return "COMERCIO_INDUSTRIA";
  if (t.includes("SERVIC") || t.includes("SERVIÇ")) return "SERVICOS";
  return null;
}

// ─── Localidade ───────────────────────────────────────────────────────────────

/** `"Cascavel - PR"` → `{ municipio: "Cascavel", uf: "PR" }`. */
export function separarCidadeUf(valor: string): {
  municipio: string | null;
  uf: string | null;
} {
  const t = valor.trim();
  if (!t) return { municipio: null, uf: null };

  const m = t.match(/^(.*?)\s*[-–/]\s*([A-Za-z]{2})$/);
  if (m) return { municipio: m[1].trim() || null, uf: m[2].toUpperCase() };

  return { municipio: t, uf: null };
}

// ─── Acessos ──────────────────────────────────────────────────────────────────

export type TipoAcesso =
  | "NFSE"
  | "GOV_BR"
  | "SIMPLES_NACIONAL"
  | "ECAC"
  | "JUNTA"
  | "PREFEITURA"
  | "ESTADUAL"
  | "BOMBEIROS"
  | "BANCO"
  | "OUTRO";

/**
 * Deduz o tipo do acesso pelo link do portal. Sem link reconhecido devolve
 * `padrao` — a planilha guarda o link junto da senha, então ele é a melhor
 * pista disponível.
 */
export function tipoAcessoPorLink(
  link: string,
  padrao: TipoAcesso = "OUTRO"
): TipoAcesso {
  const t = link.trim().toLowerCase();
  if (!t) return padrao;

  // Do mais específico para o mais genérico: os portais estaduais moram em
  // `*.gov.br`, então o teste de gov.br só pode vir depois deles.
  if (t.includes("nfse") || t.includes("nfs-e") || t.includes("esnfs"))
    return "NFSE";
  if (t.includes("bombeiros")) return "BOMBEIROS";
  if (t.includes("empresafacil") || t.includes("jucesp") || t.includes("sigfacil"))
    return "JUNTA";
  if (t.includes("receita.fazenda") || t.includes("ecac")) return "ECAC";
  if (t.includes("atende.net")) return "PREFEITURA";
  if (t.includes("gov.br")) return "GOV_BR";
  return padrao;
}

/**
 * Rótulo do acesso a partir do link, para distinguir dois portais do mesmo
 * tipo: `nfse-cascavel.atende.net/...` → `"NFSe Cascavel"`.
 */
export function rotuloAcessoPorLink(link: string): string | null {
  const t = link.trim().toLowerCase();
  if (!t) return null;

  const m = t.match(/nfse-([a-z0-9-]+)\./);
  if (m) {
    const cidade = m[1]
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    return `NFSe ${cidade}`;
  }

  try {
    return new URL(t.startsWith("http") ? t : `https://${t}`).hostname;
  } catch {
    return null;
  }
}

// ─── Fatura pessoal (aba Planilha4) ───────────────────────────────────────────

export type FormaPagamento =
  | { tipo: "RECORRENTE" }
  | { tipo: "A_VISTA" }
  | { tipo: "PARCELA"; atual: number; total: number };

/** `"Parcela 9/10"` → parcela 9 de 10; `"Plano"` → recorrente; `"A Vista"`. */
export function normalizarFormaPagamento(valor: string): FormaPagamento {
  const t = valor.trim().toUpperCase();

  const p = t.match(/PARCELA\s*(\d+)\s*\/\s*(\d+)/);
  if (p) return { tipo: "PARCELA", atual: Number(p[1]), total: Number(p[2]) };

  if (t.includes("VISTA")) return { tipo: "A_VISTA" };
  return { tipo: "RECORRENTE" };
}

// ─── Checklist mensal (aba PROCESSOS) ─────────────────────────────────────────

/** Status de uma ocorrência de obrigação, como a tabela grava. */
export type StatusOcorrencia = "PENDENTE" | "ENTREGUE" | "PAGA" | "DISPENSADA";

/**
 * Célula do checklist mensal → status da ocorrência.
 *
 * A planilha usa texto livre: `Emitido`, `Emitido Zerado`, `Não Emitido`,
 * `Não Emito` (erro de digitação recorrente), `Sem Retirada`, `Protocolado`,
 * `Solicitado`, `Sim`/`Não`. "Sem Retirada" é dispensa de verdade — não houve
 * pró-labore no mês, então não há guia a emitir.
 */
export function statusDoChecklist(valor: string): StatusOcorrencia | null {
  const t = semAcento(valor).trim().toUpperCase();
  if (!t) return null;

  if (t.includes("SEM RETIRADA") || t.includes("DISPENSAD")) return "DISPENSADA";
  // "NAO EMITIDO" / "NAO EMITO" / "NAO" — o negativo precisa ser testado antes
  // do positivo, senão "NAO EMITIDO" casaria com "EMITIDO".
  if (t.startsWith("NAO")) return "PENDENTE";
  if (t.includes("EMITIDO") || t.includes("PROTOCOLADO") || t === "SIM")
    return "ENTREGUE";
  if (t.includes("SOLICITADO") || t.includes("PENDENTE")) return "PENDENTE";
  if (t === "OK") return "ENTREGUE";
  if (t === "X") return "PENDENTE";
  return null;
}

/** `"Emitido Zerado"` marca competência sem movimento. */
export function checklistIndicaZerado(valor: string): boolean {
  return valor.trim().toUpperCase().includes("ZERAD");
}
