import { toast } from "@/components/toast";
import { AppError, normalizarErro, obterMensagemErro } from "./app-error";

export { AppError, normalizarErro, obterMensagemErro };

interface OpcoesTratamento {
  /** Mensagem amigável exibida no toast. Padrão: mensagem do próprio erro. */
  mensagemUsuario?: string;
  /** Rótulo da operação, usado no log (ex.: "salvar dívida"). */
  contexto?: string;
  /** Quando false, não exibe toast (só registra no log). Padrão: true. */
  notificar?: boolean;
}

/**
 * Ponto único de tratamento de erros do app.
 *
 * Faz o log técnico no console (com contexto) e, por padrão, dispara um toast
 * de erro amigável para o usuário. Use nos `catch` em vez de `console.error`
 * solto — assim o comportamento fica consistente em todas as telas.
 *
 * @returns a mensagem amigável que foi (ou seria) exibida.
 *
 * @example
 * try { await salvar(); }
 * catch (e) { tratarErro(e, { contexto: "salvar dívida", mensagemUsuario: "Não foi possível salvar a dívida." }); }
 */
export function tratarErro(erro: unknown, opcoes: OpcoesTratamento = {}): string {
  const { mensagemUsuario, contexto, notificar = true } = opcoes;
  const appError = normalizarErro(erro, contexto);

  const prefixo = contexto ? `[quibo] Erro ao ${contexto}:` : "[quibo] Erro:";
  // a causa original (quando existir) carrega o stack técnico real
  console.error(prefixo, appError.causa ?? appError);

  const mensagem = mensagemUsuario ?? obterMensagemErro(appError);
  if (notificar) {
    toast.erro(mensagem, {
      descricao: mensagemUsuario ? obterMensagemErro(appError) : undefined,
    });
  }
  return mensagem;
}
