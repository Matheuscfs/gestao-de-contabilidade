/**
 * Erro de domínio do Gestão de Contabilidade.
 *
 * Carrega uma mensagem amigável (para o usuário, em português) separada da
 * causa técnica original (para log/diagnóstico). Use sempre que quiser que o
 * tratamento centralizado exiba algo específico em vez da mensagem genérica.
 */
export class AppError extends Error {
  /** Causa técnica original (exceção lançada por baixo). */
  readonly causa?: unknown;
  /** Identificador opcional da operação, ajuda no log. */
  readonly contexto?: string;

  constructor(
    mensagem: string,
    opcoes: { causa?: unknown; contexto?: string } = {}
  ) {
    super(mensagem);
    this.name = "AppError";
    this.causa = opcoes.causa;
    this.contexto = opcoes.contexto;
  }
}

/**
 * Extrai uma mensagem legível de qualquer valor lançado (Error, string,
 * objeto desconhecido). Nunca lança.
 */
export function obterMensagemErro(erro: unknown): string {
  if (erro instanceof AppError) return erro.message;
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "string") return erro;
  if (erro && typeof erro === "object" && "message" in erro) {
    return String((erro as { message: unknown }).message);
  }
  return "Ocorreu um erro inesperado.";
}

/**
 * Normaliza qualquer valor lançado em um `AppError`, preservando a causa.
 */
export function normalizarErro(erro: unknown, contexto?: string): AppError {
  if (erro instanceof AppError) return erro;
  return new AppError(obterMensagemErro(erro), { causa: erro, contexto });
}
