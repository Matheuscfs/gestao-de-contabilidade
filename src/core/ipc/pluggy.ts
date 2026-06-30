import { invoke } from "@tauri-apps/api/core";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusCredenciais = {
  configurado: boolean;
};

export type ItemResumo = {
  pluggyItemId: string;
  connectorName: string | null;
  status: string;
  lastSyncedAt: string | null;
  nextAutoSyncAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ResultadoSync = {
  pluggyItemId: string;
  connectorName: string | null;
  /** "SUCCESS" | "ERROR" | "SKIPPED" | "LOGIN_ERROR" | "WAITING_USER_INPUT" */
  status: string;
  entriesImportados: number;
  entriesAtualizados: number;
  investimentosSincronizados: number;
  faturasSincronizadas: number;
  erro: string | null;
  syncedAt: string;
  proximoSync: string | null;
};

export type ContaPluggyResumo = {
  pluggyAccountId: string;
  name: string;
  tipo: string;
  balanceCents: number;
  accountNumber: string | null;
};

export type RecorrenteItem = {
  description: string;
  amountCents: number;
  frequency: string | null;
  category: string | null;
  nextTransaction: string | null;
};

export type RecorrentesResumo = {
  quantidade: number;
  totalMensalCentavos: number;
  itens: RecorrenteItem[];
};

// ─── Credenciais ──────────────────────────────────────────────────────────────

export async function pluggyStatusCredenciais(): Promise<StatusCredenciais> {
  return invoke<StatusCredenciais>("pluggy_status_credenciais");
}

export async function pluggySalvarCredenciais(
  clientId: string,
  clientSecret: string
): Promise<void> {
  return invoke("pluggy_salvar_credenciais", { clientId, clientSecret });
}

export async function pluggyRemoverCredenciais(): Promise<void> {
  return invoke("pluggy_remover_credenciais");
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function pluggyListarItems(): Promise<ItemResumo[]> {
  return invoke<ItemResumo[]>("pluggy_listar_items");
}

/** Busca items na API Pluggy e registra os novos no banco local. Retorna a lista atualizada. */
export async function pluggyDescobrirItems(): Promise<ItemResumo[]> {
  return invoke<ItemResumo[]>("pluggy_descobrir_items");
}

/**
 * Fluxo OAuth local: abre MeuPluggy no browser com um Connect Token,
 * aguarda o redirect de callback com itemId, valida e registra o banco.
 * Bloqueia por até 5 minutos aguardando o usuário conectar.
 */
export async function pluggyIniciarConexao(): Promise<ItemResumo> {
  return invoke<ItemResumo>("pluggy_iniciar_conexao");
}

export async function pluggyRegistrarItem(
  pluggyItemId: string
): Promise<ItemResumo> {
  return invoke<ItemResumo>("pluggy_registrar_item", { pluggyItemId });
}

export async function pluggyListarContasItem(
  pluggyItemId: string
): Promise<ContaPluggyResumo[]> {
  return invoke<ContaPluggyResumo[]>("pluggy_listar_contas_item", {
    pluggyItemId,
  });
}

export async function pluggySalvarMapeamento(
  pluggyItemId: string,
  mapeamento: Record<string, string>
): Promise<void> {
  return invoke("pluggy_salvar_mapeamento", { pluggyItemId, mapeamento });
}

export async function pluggyRemoverItem(pluggyItemId: string): Promise<void> {
  return invoke("pluggy_remover_item", { pluggyItemId });
}

/** Remove o item e todos os dados locais: transactions, accounts, credit_cards, integrations. */
export async function pluggyRemoverItemCompleto(
  pluggyItemId: string,
  pluggyAccountIds: string[],
): Promise<void> {
  return invoke("pluggy_remover_item_completo", { pluggyItemId, pluggyAccountIds });
}

export async function pluggyDeletarItemRemoto(
  pluggyItemId: string
): Promise<void> {
  return invoke("pluggy_deletar_item_remoto", { pluggyItemId });
}

// ─── Sincronização ────────────────────────────────────────────────────────────

export async function pluggySincronizarItem(
  pluggyItemId: string,
  forcar = false
): Promise<ResultadoSync> {
  return invoke<ResultadoSync>("pluggy_sincronizar_item", {
    pluggyItemId,
    forcar,
  });
}

export async function pluggySincronizarTodos(
  forcar = false
): Promise<ResultadoSync[]> {
  return invoke<ResultadoSync[]>("pluggy_sincronizar_todos", { forcar });
}

// ─── Intelligence ─────────────────────────────────────────────────────────────

export async function pluggyRecorrentes(
  pluggyItemId: string
): Promise<RecorrentesResumo> {
  return invoke<RecorrentesResumo>("pluggy_recorrentes", { pluggyItemId });
}
