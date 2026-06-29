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

/** Remove a integração de IA. */
export async function aiRemoverIntegracao(): Promise<void> {
  return invoke("ai_remover_integracao");
}
