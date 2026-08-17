import { describe, expect, it } from "vitest";

import { CATALOGO_OBRIGACOES } from "./obrigacoes";
import {
  ETAPAS_GENERICAS,
  FLUXOS_PADRAO,
  etapaSeAplica,
  fluxoPadrao,
  type ContextoEtapa,
} from "./fluxos";
import { colunaDoCard } from "@/core/db/kanban";

const BASE: ContextoEtapa = {
  temProLabore: false,
  temFuncionarios: false,
  semMovimento: false,
};

describe("fluxoPadrao", () => {
  it("entrega o fluxo do Simples que o escritório usa", () => {
    const das = fluxoPadrao("DAS").map((e) => e.descricao);
    expect(das).toContain("Gerar guia do DAS");
    expect(das).toContain("Enviar guia ao cliente");
  });

  it("cobre SPED Fiscal e SPED Contábil do Presumido", () => {
    expect(fluxoPadrao("EFD_ICMS_IPI").map((e) => e.descricao)).toContain(
      "Transmitir o SPED Fiscal"
    );
    expect(fluxoPadrao("ECD").map((e) => e.descricao)).toContain(
      "Transmitir o SPED Contábil"
    );
  });

  it("cai no fluxo genérico para código sem etapas próprias", () => {
    expect(fluxoPadrao("CODIGO_QUE_NAO_EXISTE")).toEqual(ETAPAS_GENERICAS);
  });

  it("toda obrigação do catálogo termina com pelo menos uma etapa", () => {
    for (const def of CATALOGO_OBRIGACOES) {
      expect(fluxoPadrao(def.codigo).length).toBeGreaterThan(0);
    }
  });

  it("não define fluxo para código fora do catálogo", () => {
    const codigos = new Set(CATALOGO_OBRIGACOES.map((d) => d.codigo));
    for (const codigo of Object.keys(FLUXOS_PADRAO)) {
      expect(codigos.has(codigo)).toBe(true);
    }
  });
});

describe("etapaSeAplica", () => {
  it("etapa sem condição entra sempre", () => {
    expect(etapaSeAplica(null, BASE)).toBe(true);
    expect(etapaSeAplica(undefined, BASE)).toBe(true);
  });

  it("as etapas de pró-labore se excluem", () => {
    const com = { ...BASE, temProLabore: true };
    expect(etapaSeAplica("TEM_PRO_LABORE", com)).toBe(true);
    expect(etapaSeAplica("SEM_PRO_LABORE", com)).toBe(false);

    expect(etapaSeAplica("TEM_PRO_LABORE", BASE)).toBe(false);
    expect(etapaSeAplica("SEM_PRO_LABORE", BASE)).toBe(true);
  });

  it("movimento e folha respeitam a empresa", () => {
    expect(etapaSeAplica("SEM_MOVIMENTO", { ...BASE, semMovimento: true })).toBe(true);
    expect(etapaSeAplica("COM_MOVIMENTO", { ...BASE, semMovimento: true })).toBe(false);
    expect(etapaSeAplica("TEM_FUNCIONARIOS", { ...BASE, temFuncionarios: true })).toBe(
      true
    );
    expect(etapaSeAplica("TEM_FUNCIONARIOS", BASE)).toBe(false);
  });

  it("empresa com pró-labore recebe as 3 etapas do INSS e não a de 'sem retirada'", () => {
    const ctx = { ...BASE, temProLabore: true };
    const aplicaveis = fluxoPadrao("INSS_DARF").filter((e) =>
      etapaSeAplica(e.condicao, ctx)
    );
    expect(aplicaveis.map((e) => e.descricao)).toEqual([
      "Conferir o pró-labore do mês",
      "Emitir a guia do pró-labore",
      "Enviar guia ao cliente",
    ]);
  });

  it("empresa sem pró-labore só registra que não houve retirada", () => {
    const aplicaveis = fluxoPadrao("INSS_DARF").filter((e) =>
      etapaSeAplica(e.condicao, BASE)
    );
    expect(aplicaveis.map((e) => e.descricao)).toEqual([
      "Registrar que não houve retirada",
    ]);
  });

  it("a etapa de entrega zerada do DAS só aparece em empresa sem movimento", () => {
    const zerada = fluxoPadrao("DAS").filter((e) =>
      etapaSeAplica(e.condicao, { ...BASE, semMovimento: true })
    );
    const ativa = fluxoPadrao("DAS").filter((e) => etapaSeAplica(e.condicao, BASE));
    expect(zerada.map((e) => e.descricao)).toContain("Confirmar entrega zerada");
    expect(ativa.map((e) => e.descricao)).not.toContain("Confirmar entrega zerada");
  });
});

describe("colunaDoCard", () => {
  const pendente = (feitas: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({ concluida: i < feitas }));

  it("pendente sem nenhuma etapa cumprida fica em A fazer", () => {
    expect(colunaDoCard("PENDENTE", pendente(0, 3))).toBe("A_FAZER");
  });

  it("pendente com etapa cumprida vai para Fazendo", () => {
    expect(colunaDoCard("PENDENTE", pendente(1, 3))).toBe("FAZENDO");
    expect(colunaDoCard("PENDENTE", pendente(2, 3))).toBe("FAZENDO");
  });

  it("entregue, paga ou dispensada caem em Concluído", () => {
    expect(colunaDoCard("ENTREGUE", pendente(3, 3))).toBe("CONCLUIDO");
    expect(colunaDoCard("PAGA", pendente(0, 3))).toBe("CONCLUIDO");
    expect(colunaDoCard("DISPENSADA", pendente(0, 3))).toBe("CONCLUIDO");
  });

  it("checklist inteiro cumprido mas ainda pendente não conclui sozinho", () => {
    // Marcar as etapas é o trabalho; concluir é um ato explícito (arrastar o
    // card ou clicar em concluir), senão o card sumiria da mão do usuário.
    expect(colunaDoCard("PENDENTE", pendente(3, 3))).toBe("FAZENDO");
  });

  it("card sem checklist depende só do status", () => {
    expect(colunaDoCard("PENDENTE", [])).toBe("A_FAZER");
    expect(colunaDoCard("ENTREGUE", [])).toBe("CONCLUIDO");
  });
});
