/**
 * Interpretação de comandos em linguagem natural sobre o quadro de obrigações.
 *
 * "A IA é a voz, a calculadora é local e burra": o modelo só **identifica** a
 * que card/etapa a frase se refere. Quem valida os ids, resolve os nomes e
 * grava é este módulo mais a tela — o modelo nunca escreve no banco e nunca
 * decide sozinho. Toda ação passa pela confirmação do usuário.
 *
 * Tudo aqui é puro: recebe o texto cru do modelo e a lista real de cards,
 * devolve ações resolvidas. É o que permite testar o caminho sem chamar a API.
 */

import type { CardKanban, EtapaCard } from "@/core/db/kanban";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Ação já casada com um card real do quadro. */
export type AcaoResolvida = {
  card: CardKanban;
  /** null = concluir o card inteiro. */
  etapa: EtapaCard | null;
  motivo: string;
};

export type Interpretacao = {
  acoes: AcaoResolvida[];
  /** Pergunta do modelo quando ele não teve certeza, ou null. */
  duvida: string | null;
  /**
   * Itens que o modelo devolveu mas não existem no quadro (id inventado, card
   * já concluído, etapa de outro card). Ficam visíveis em vez de sumirem —
   * silenciar alucinação é pior do que mostrá-la.
   */
  descartadas: string[];
};

// ─── Catálogo enviado ao modelo ───────────────────────────────────────────────

/**
 * Monta o JSON compacto das tarefas em aberto.
 *
 * Só vai o necessário para o modelo casar a frase: nada de valores, vencimentos
 * ou dados do cliente. Cards já concluídos ficam de fora — não há o que marcar
 * neles, e cada card a menos é menos chance de o modelo errar o alvo.
 */
export function montarCatalogoTarefas(cards: CardKanban[]): string {
  const abertos = cards
    .filter((c) => c.coluna !== "CONCLUIDO")
    .map((c) => ({
      cardId: c.id,
      empresa: c.empresaNome,
      obrigacao: c.obrigacaoNome,
      codigo: c.obrigacaoCodigo,
      etapas: c.etapas
        .filter((e) => !e.concluida)
        .map((e) => ({ etapaId: e.id, descricao: e.descricao })),
    }));
  return JSON.stringify({ tarefas: abertos });
}

// ─── Leitura da resposta ──────────────────────────────────────────────────────

/**
 * Extrai o objeto JSON da resposta do modelo.
 *
 * Modelos teimam em embrulhar JSON em ```json ... ``` ou em enfeitar com uma
 * frase antes. Em vez de exigir obediência no prompt, aceita-se a bagunça:
 * tira as cercas e, se ainda não parsear, pega do primeiro `{` ao último `}`.
 */
export function extrairJson(texto: string): unknown {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(limpo);
  } catch {
    // segue para o recorte por chaves
  }

  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;

  try {
    return JSON.parse(limpo.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/**
 * Casa o que o modelo devolveu com os cards reais.
 *
 * Regra dura: id que não existe no quadro é descartado, nunca "aproximado".
 * Preferimos mostrar menos ações do que marcar a obrigação da empresa errada.
 */
export function interpretarResposta(
  respostaBruta: string,
  cards: CardKanban[]
): Interpretacao {
  const dados = extrairJson(respostaBruta);

  if (!dados || typeof dados !== "object") {
    return {
      acoes: [],
      duvida:
        "Não consegui entender a resposta da IA. Tente reformular a frase, " +
        "dizendo a empresa e a obrigação.",
      descartadas: [],
    };
  }

  const obj = dados as Record<string, unknown>;
  const porCardId = new Map(cards.map((c) => [c.id, c]));

  const acoes: AcaoResolvida[] = [];
  const descartadas: string[] = [];
  const vistas = new Set<string>();

  const brutas = Array.isArray(obj.acoes) ? obj.acoes : [];
  for (const bruta of brutas) {
    if (!bruta || typeof bruta !== "object") continue;
    const item = bruta as Record<string, unknown>;

    const cardId = texto(item.cardId);
    const card = cardId ? porCardId.get(cardId) : undefined;
    if (!card) {
      descartadas.push(
        `Card "${cardId ?? "sem id"}" não está no quadro desta competência.`
      );
      continue;
    }

    const etapaId = texto(item.etapaId);
    let etapa: EtapaCard | null = null;
    if (etapaId) {
      etapa = card.etapas.find((e) => e.id === etapaId) ?? null;
      if (!etapa) {
        descartadas.push(
          `Etapa "${etapaId}" não pertence a ${card.empresaNome} · ${card.obrigacaoNome}.`
        );
        continue;
      }
      if (etapa.concluida) {
        descartadas.push(
          `${card.empresaNome} · ${card.obrigacaoNome}: "${etapa.descricao}" já estava concluída.`
        );
        continue;
      }
    }

    // Mesma ação repetida pelo modelo não vira duas linhas na confirmação.
    const chave = `${card.id}|${etapa?.id ?? ""}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);

    acoes.push({
      card,
      etapa,
      motivo: texto(item.motivo) ?? "",
    });
  }

  return {
    acoes,
    duvida: texto(obj.duvida),
    descartadas,
  };
}

/** Frase curta descrevendo a ação, para a lista de confirmação. */
export function descreverAcao(acao: AcaoResolvida): string {
  const alvo = `${acao.card.empresaNome} · ${acao.card.obrigacaoNome}`;
  return acao.etapa ? `${alvo} — ${acao.etapa.descricao}` : `${alvo} — concluir tudo`;
}
