import { describe, expect, it } from "vitest";

import {
  calcularEncargos,
  calcularItemProLabore,
  calcularItemSalario,
  cppForaDoDas,
  deveTerceiros,
  folhaRealParaFatorR,
  ratAjustadoCentesimos,
  TERCEIROS_PADRAO_CENTESIMOS,
  type ParametrosEncargo,
} from "./folha";

const SIMPLES_III: ParametrosEncargo = {
  regime: "SIMPLES",
  anexoSimples: "III",
  ratCentesimos: 200,
  fapDecimilesimos: 10_000,
  terceirosCentesimos: TERCEIROS_PADRAO_CENTESIMOS,
};

const SIMPLES_IV: ParametrosEncargo = { ...SIMPLES_III, anexoSimples: "IV" };

const PRESUMIDO: ParametrosEncargo = {
  regime: "PRESUMIDO",
  anexoSimples: null,
  ratCentesimos: 200,
  fapDecimilesimos: 10_000,
  terceirosCentesimos: TERCEIROS_PADRAO_CENTESIMOS,
};

// ─── Destino dos encargos por regime ──────────────────────────────────────────

describe("cppForaDoDas", () => {
  it("Simples nos anexos I–III e V recolhe tudo dentro do DAS", () => {
    expect(cppForaDoDas("SIMPLES", "I")).toBe(false);
    expect(cppForaDoDas("SIMPLES", "III")).toBe(false);
    expect(cppForaDoDas("SIMPLES", "V")).toBe(false);
  });

  it("Anexo IV, Presumido e Real recolhem por fora", () => {
    expect(cppForaDoDas("SIMPLES", "IV")).toBe(true);
    expect(cppForaDoDas("PRESUMIDO", null)).toBe(true);
    expect(cppForaDoDas("REAL", null)).toBe(true);
  });

  it("MEI não tem CPP patronal por fora", () => {
    expect(cppForaDoDas("MEI", null)).toBe(false);
  });
});

describe("deveTerceiros", () => {
  it("o Simples é isento do Sistema S em todos os anexos, inclusive o IV", () => {
    expect(deveTerceiros("SIMPLES")).toBe(false);
    expect(deveTerceiros("MEI")).toBe(false);
  });

  it("Presumido e Real recolhem terceiros", () => {
    expect(deveTerceiros("PRESUMIDO")).toBe(true);
    expect(deveTerceiros("REAL")).toBe(true);
  });
});

describe("ratAjustadoCentesimos", () => {
  it("FAP neutro não altera o RAT", () => {
    expect(ratAjustadoCentesimos(200, 10_000)).toBe(200);
  });

  it("FAP mínimo corta pela metade e o máximo dobra", () => {
    expect(ratAjustadoCentesimos(200, 5_000)).toBe(100);
    expect(ratAjustadoCentesimos(200, 20_000)).toBe(400);
  });

  it("preserva as 4 casas do FAP publicado", () => {
    // RAT 2% × FAP 1,1234 = 2,2468% → 225 centésimos
    expect(ratAjustadoCentesimos(200, 11_234)).toBe(225);
  });
});

// ─── Encargos ─────────────────────────────────────────────────────────────────

describe("calcularEncargos", () => {
  it("Simples Anexo III: só FGTS, o resto está no DAS", () => {
    const e = calcularEncargos(300_000, SIMPLES_III, true);
    expect(e.fgtsCents).toBe(24_000);
    expect(e.cppCents).toBe(0);
    expect(e.ratCents).toBe(0);
    expect(e.terceirosCents).toBe(0);
    expect(e.totalCents).toBe(24_000);
  });

  it("Simples Anexo IV: FGTS, CPP e RAT — mas nunca terceiros", () => {
    const e = calcularEncargos(300_000, SIMPLES_IV, true);
    expect(e.fgtsCents).toBe(24_000);
    expect(e.cppCents).toBe(60_000); // 20%
    expect(e.ratCents).toBe(6_000); // 2%
    expect(e.terceirosCents).toBe(0); // isento
    expect(e.totalCents).toBe(90_000);
  });

  it("Presumido: encargo completo com terceiros", () => {
    const e = calcularEncargos(300_000, PRESUMIDO, true);
    expect(e.fgtsCents).toBe(24_000); // 8%
    expect(e.cppCents).toBe(60_000); // 20%
    expect(e.ratCents).toBe(6_000); // 2%
    expect(e.terceirosCents).toBe(17_400); // 5,8%
    // 35,8% de encargo sobre a folha — bem longe dos 20% que o app assumia.
    expect(e.totalCents).toBe(107_400);
  });

  it("pró-labore não gera FGTS nem RAT, mas gera CPP quando ela sai por fora", () => {
    const dentro = calcularEncargos(300_000, SIMPLES_III, false);
    expect(dentro.totalCents).toBe(0);

    const fora = calcularEncargos(300_000, PRESUMIDO, false);
    expect(fora.fgtsCents).toBe(0);
    expect(fora.ratCents).toBe(0);
    expect(fora.terceirosCents).toBe(0);
    expect(fora.cppCents).toBe(60_000);
    expect(fora.totalCents).toBe(60_000);
  });

  it("base zerada não gera encargo", () => {
    expect(calcularEncargos(0, PRESUMIDO, true).totalCents).toBe(0);
  });
});

// ─── Itens ────────────────────────────────────────────────────────────────────

describe("calcularItemSalario", () => {
  const proventos = {
    baseCents: 300_000,
    decimoTerceiroCents: 0,
    feriasCents: 0,
    tercoFeriasCents: 0,
    outrosProventosCents: 0,
  };

  it("líquido = proventos − INSS − IRRF − outros descontos", () => {
    const r = calcularItemSalario(proventos, 0, 0, SIMPLES_III);
    expect(r.proventosCents).toBe(300_000);
    expect(r.inssCents).toBe(24_860); // tabela progressiva 2026
    expect(r.liquidoCents).toBe(300_000 - r.descontosCents);
  });

  it("custo total soma os encargos, que não saem do bolso da pessoa", () => {
    const r = calcularItemSalario(proventos, 0, 0, PRESUMIDO);
    expect(r.custoTotalCents).toBe(300_000 + r.encargos.totalCents);
    // O encargo não aparece no líquido.
    expect(r.liquidoCents).toBe(300_000 - r.descontosCents);
  });

  it("13º e férias somam à base e aumentam o encargo", () => {
    const comExtras = calcularItemSalario(
      { ...proventos, decimoTerceiroCents: 300_000, tercoFeriasCents: 100_000 },
      0,
      0,
      PRESUMIDO
    );
    expect(comExtras.proventosCents).toBe(700_000);
    expect(comExtras.encargos.fgtsCents).toBe(56_000); // 8% de 700.000
  });

  it("outros descontos reduzem o líquido sem mexer no encargo", () => {
    const sem = calcularItemSalario(proventos, 0, 0, PRESUMIDO);
    const com = calcularItemSalario(proventos, 0, 50_000, PRESUMIDO);
    expect(com.liquidoCents).toBe(sem.liquidoCents - 50_000);
    expect(com.encargos.totalCents).toBe(sem.encargos.totalCents);
  });
});

describe("calcularItemProLabore", () => {
  it("usa 11% até o teto, não a tabela progressiva", () => {
    const r = calcularItemProLabore(300_000, 0, 0, SIMPLES_III);
    expect(r.inssCents).toBe(33_000); // 11% de 3.000
  });

  it("respeita o teto do INSS", () => {
    const r = calcularItemProLabore(2_000_000, 0, 0, SIMPLES_III);
    expect(r.inssCents).toBe(93_231); // 11% de 8.475,55
  });

  it("aplica o redutor da Lei 15.270/2025", () => {
    // R$ 5.000 fica isento pelo redutor, mesmo caindo em faixa tributável.
    expect(calcularItemProLabore(500_000, 0, 0, SIMPLES_III).irrfCents).toBe(0);
  });
});

// ─── Fator R a partir da folha real ───────────────────────────────────────────

describe("folhaRealParaFatorR", () => {
  it("soma remunerações, CPP recolhida e FGTS", () => {
    const total = folhaRealParaFatorR([
      { proventosCents: 300_000, cppCents: 60_000, fgtsCents: 24_000 },
      { proventosCents: 200_000, cppCents: 40_000, fgtsCents: 16_000 },
    ]);
    expect(total).toBe(640_000);
  });

  it("empresa do Anexo III soma só remunerações e FGTS", () => {
    // CPP zerada porque está dentro do DAS — não foi "efetivamente recolhida".
    const total = folhaRealParaFatorR([
      { proventosCents: 300_000, cppCents: 0, fgtsCents: 24_000 },
    ]);
    expect(total).toBe(324_000);
  });

  it("sem competência fechada o numerador é zero", () => {
    expect(folhaRealParaFatorR([])).toBe(0);
  });
});
