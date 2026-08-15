import { invoke } from "@tauri-apps/api/core";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Identificadores aceitos pelo backend. */
export type AiProvider = "ANTHROPIC" | "OPENAI" | "GOOGLE" | "OPENROUTER";

export type ModeloDisponivel = {
  /** id técnico usado nas chamadas (ex.: "claude-sonnet-4-5") */
  id: string;
  /** rótulo amigável (ex.: "Claude Sonnet 4.5") */
  label: string;
};

export type AiIntegracao = {
  provider: AiProvider;
  model: string | null;
  modelos: ModeloDisponivel[];
  /** Permite enviar ao modelo os totais do mês e os gastos por categoria. */
  podeLerMes: boolean;
  /** Permite enviar saldo das contas, custo de vida, dívidas e metas. */
  podeUsarContextoDeVida: boolean;
};

/** Uma fala da conversa. O histórico é enviado inteiro a cada rodada. */
export type MensagemChat = {
  /** "user" = o usuário; "assistant" = o modelo. */
  papel: "user" | "assistant";
  texto: string;
};

export type RespostaConversa = {
  /** Texto devolvido pelo modelo. */
  texto: string;
  /** Modelo que respondeu. */
  modelo: string;
  /** true quando o resumo financeiro foi anexado ao pedido. */
  contextoIncluido: boolean;
};

// ─── Comandos ─────────────────────────────────────────────────────────────────

/**
 * Valida a chave junto ao provedor e devolve os modelos disponíveis.
 * A chave não é gravada — só é usada para a verificação.
 */
export async function aiVerificarChave(
  provider: AiProvider,
  apiKey: string
): Promise<ModeloDisponivel[]> {
  return invoke<ModeloDisponivel[]>("ai_verificar_chave", { provider, apiKey });
}

/** Retorna a integração de IA ativa (sem expor a chave), ou null. */
export async function aiObterIntegracao(): Promise<AiIntegracao | null> {
  return invoke<AiIntegracao | null>("ai_obter_integracao");
}

/** Grava a integração de IA. Só pode existir uma — a anterior é substituída. */
export async function aiSalvarIntegracao(
  provider: AiProvider,
  apiKey: string,
  model: string,
  modelos: ModeloDisponivel[]
): Promise<void> {
  return invoke("ai_salvar_integracao", { provider, apiKey, model, modelos });
}

/** Atualiza só o modelo selecionado da integração ativa, sem mexer na chave. */
export async function aiAtualizarModelo(model: string): Promise<void> {
  return invoke("ai_atualizar_modelo", { model });
}

/**
 * Define o que a IA pode ler do banco local. Com as duas desligadas, o modelo
 * responde sem receber nenhum número seu.
 */
export async function aiAtualizarPermissoes(
  podeLerMes: boolean,
  podeUsarContextoDeVida: boolean
): Promise<void> {
  return invoke("ai_atualizar_permissoes", { podeLerMes, podeUsarContextoDeVida });
}

/** Remove a integração de IA. */
export async function aiRemoverIntegracao(): Promise<void> {
  return invoke("ai_remover_integracao");
}

/**
 * Manda a conversa ao modelo configurado e devolve a resposta.
 *
 * O contexto financeiro é montado no Rust, respeitando as permissões gravadas
 * na integração (`ai_can_read_monthly` e `ai_can_use_life_context`) — o
 * frontend só informa qual competência está em foco.
 */
export async function aiConversar(
  mensagens: MensagemChat[],
  mes: number,
  ano: number
): Promise<RespostaConversa> {
  return invoke<RespostaConversa>("ai_conversar", { mensagens, mes, ano });
}
