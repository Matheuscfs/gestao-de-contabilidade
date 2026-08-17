import { describe, expect, it } from "vitest";

import type { CardKanban } from "@/core/db/kanban";
import {
  descreverAcao,
  extrairJson,
  interpretarResposta,
  montarCatalogoTarefas,
} from "./comando-kanban";

// ─── Quadro de mentira ────────────────────────────────────────────────────────

function card(over: Partial<CardKanban> & { id: string }): CardKanban {
  return {
    empresaId: `emp-${over.id}`,
    empresaNome: "A C LATANCE LTDA",
    obrigacaoCodigo: "DAS",
    obrigacaoNome: "DAS",
    competenciaMes: 7,
    competenciaAno: 2026,
    vencimento: "2026-08-20",
    status: "PENDENTE",
    atrasada: false,
    etapas: [],
    coluna: "A_FAZER",
    ...over,
  } as CardKanban;
}

const LATANCE = card({
  id: "c1",
  empresaNome: "A C LATANCE LTDA",
  etapas: [
    { id: "e1", descricao: "Gerar guia do DAS", ordem: 0, concluida: false },
    { id: "e2", descricao: "Enviar guia ao cliente", ordem: 1, concluida: false },
  ],
});

const AGTENIS = card({
  id: "c2",
  empresaNome: "AG TENIS PERFORMANCE LTDA",
  etapas: [
    { id: "e3", descricao: "Gerar guia do DAS", ordem: 0, concluida: true },
  ],
  coluna: "FAZENDO",
});

const CONCLUIDO = card({
  id: "c3",
  empresaNome: "EDSON XAVIER DE BARROS",
  status: "ENTREGUE",
  coluna: "CONCLUIDO",
  etapas: [{ id: "e4", descricao: "Gerar guia do DAS", ordem: 0, concluida: true }],
});

const QUADRO = [LATANCE, AGTENIS, CONCLUIDO];

// ─── Catálogo ─────────────────────────────────────────────────────────────────

describe("montarCatalogoTarefas", () => {
  it("manda só os cards abertos e as etapas que faltam", () => {
    const catalogo = JSON.parse(montarCatalogoTarefas(QUADRO));
    expect(catalogo.tarefas).toHaveLength(2);
    expect(catalogo.tarefas.map((t: { cardId: string }) => t.cardId)).toEqual([
      "c1",
      "c2",
    ]);
    // c2 já cumpriu a única etapa: sobra card, mas sem etapa a marcar.
    expect(catalogo.tarefas[1].etapas).toEqual([]);
  });

  it("não vaza vencimento nem valores para o modelo", () => {
    const bruto = montarCatalogoTarefas(QUADRO);
    expect(bruto).not.toContain("2026-08-20");
    expect(bruto).not.toContain("vencimento");
  });
});

// ─── Extração de JSON ─────────────────────────────────────────────────────────

describe("extrairJson", () => {
  it("lê JSON puro", () => {
    expect(extrairJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("tira as cercas de código que o modelo insiste em colocar", () => {
    expect(extrairJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extrairJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("acha o objeto no meio de prosa", () => {
    expect(extrairJson('Claro! Aqui está:\n{"a":1}\nEspero ter ajudado.')).toEqual({
      a: 1,
    });
  });

  it("devolve null quando não há JSON", () => {
    expect(extrairJson("desculpe, não entendi")).toBeNull();
    expect(extrairJson("")).toBeNull();
  });
});

// ─── Interpretação ────────────────────────────────────────────────────────────

describe("interpretarResposta", () => {
  it("resolve etapa específica de um card", () => {
    const r = interpretarResposta(
      '{"acoes":[{"cardId":"c1","etapaId":"e1","motivo":"latance = A C LATANCE"}],"duvida":null}',
      QUADRO
    );
    expect(r.acoes).toHaveLength(1);
    expect(r.acoes[0].card.id).toBe("c1");
    expect(r.acoes[0].etapa?.id).toBe("e1");
    expect(r.duvida).toBeNull();
    expect(r.descartadas).toEqual([]);
  });

  it("etapaId null significa concluir o card inteiro", () => {
    const r = interpretarResposta(
      '{"acoes":[{"cardId":"c1","etapaId":null,"motivo":"fiz tudo"}]}',
      QUADRO
    );
    expect(r.acoes[0].etapa).toBeNull();
    expect(descreverAcao(r.acoes[0])).toBe("A C LATANCE LTDA · DAS — concluir tudo");
  });

  it("descarta id inventado em vez de aproximar", () => {
    const r = interpretarResposta(
      '{"acoes":[{"cardId":"c-inexistente","etapaId":null,"motivo":"x"}]}',
      QUADRO
    );
    expect(r.acoes).toEqual([]);
    expect(r.descartadas[0]).toContain("não está no quadro");
  });

  it("descarta etapa que pertence a outro card", () => {
    const r = interpretarResposta(
      '{"acoes":[{"cardId":"c1","etapaId":"e3","motivo":"x"}]}',
      QUADRO
    );
    expect(r.acoes).toEqual([]);
    expect(r.descartadas[0]).toContain("não pertence a A C LATANCE LTDA");
  });

  it("avisa quando a etapa já estava concluída, sem refazer", () => {
    const r = interpretarResposta(
      '{"acoes":[{"cardId":"c2","etapaId":"e3","motivo":"x"}]}',
      QUADRO
    );
    expect(r.acoes).toEqual([]);
    expect(r.descartadas[0]).toContain("já estava concluída");
  });

  it("não duplica a mesma ação repetida pelo modelo", () => {
    const r = interpretarResposta(
      '{"acoes":[{"cardId":"c1","etapaId":"e1","motivo":"a"},{"cardId":"c1","etapaId":"e1","motivo":"b"}]}',
      QUADRO
    );
    expect(r.acoes).toHaveLength(1);
  });

  it("aceita várias empresas numa frase só", () => {
    const r = interpretarResposta(
      '{"acoes":[{"cardId":"c1","etapaId":null,"motivo":"a"},{"cardId":"c2","etapaId":null,"motivo":"b"}]}',
      QUADRO
    );
    expect(r.acoes.map((a) => a.card.id)).toEqual(["c1", "c2"]);
  });

  it("repassa a dúvida do modelo em vez de chutar", () => {
    const r = interpretarResposta(
      '{"acoes":[],"duvida":"Você quis dizer D M CICHY ou DM CICHY AGRICOLAS?"}',
      QUADRO
    );
    expect(r.acoes).toEqual([]);
    expect(r.duvida).toContain("D M CICHY");
  });

  it("resposta ininteligível vira orientação, não exceção", () => {
    const r = interpretarResposta("não sei", QUADRO);
    expect(r.acoes).toEqual([]);
    expect(r.duvida).toContain("Não consegui entender");
  });

  it("aguenta acoes ausente ou com lixo dentro", () => {
    expect(interpretarResposta('{"duvida":null}', QUADRO).acoes).toEqual([]);
    expect(
      interpretarResposta('{"acoes":[null,42,"oi"],"duvida":null}', QUADRO).acoes
    ).toEqual([]);
  });
});
