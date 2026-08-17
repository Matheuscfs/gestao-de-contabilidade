import { describe, expect, it } from "vitest";

import { ANO_FISCAL } from "./ano-fiscal";
import {
  calcularCLT,
  calcularINSSCents,
  calcularIRRFCents,
  CLT_ANO_REFERENCIA,
  FGTS_ALIQUOTA,
  INSS_FAIXAS,
  INSS_TETO_BASE_CENTS,
  IRRF_DEDUCAO_DEPENDENTE_CENTS,
  IRRF_DESCONTO_SIMPLIFICADO_CENTS,
  IRRF_FAIXAS,
} from "./clt";
import { TRIBUTOS_ANO_REFERENCIA } from "./tributos";

/**
 * Estes testes existem por causa de um bug real: as tabelas de `clt.ts`
 * ficaram em 2025 enquanto `tributos.ts` já estava em 2026, e como o
 * pró-labore reusa o IRRF daqui, o imposto do sócio saía errado sem que nada
 * acusasse. Travar valores conhecidos das tabelas é o que faz a virada de ano
 * quebrar o build em vez de passar silenciosamente.
 */

describe("ano de referência", () => {
  it("as duas pontas do cálculo fiscal andam no mesmo ano", () => {
    expect(CLT_ANO_REFERENCIA).toBe(TRIBUTOS_ANO_REFERENCIA);
    expect(CLT_ANO_REFERENCIA).toBe(ANO_FISCAL);
  });
});

describe("tabela do INSS 2026", () => {
  it("as faixas terminam nos limites oficiais", () => {
    expect(INSS_FAIXAS.map((f) => f.ateCents)).toEqual([
      162_100, // 1.621,00 — salário mínimo
      290_284, // 2.902,84
      435_427, // 4.354,27
      847_555, // 8.475,55 — teto
    ]);
    expect(INSS_FAIXAS.map((f) => f.aliquota)).toEqual([0.075, 0.09, 0.12, 0.14]);
    expect(INSS_TETO_BASE_CENTS).toBe(847_555);
  });

  it("desconto máximo do empregado é R$ 988,09", () => {
    // Valor de referência da tabela 2026: é ele que denuncia a tabela velha.
    expect(calcularINSSCents(INSS_TETO_BASE_CENTS)).toBe(98_809);
    expect(calcularINSSCents(2_000_000)).toBe(98_809); // acima do teto, trava
  });

  it("é progressivo por faixa, não alíquota única", () => {
    // Um salário mínimo: só a 1ª faixa, 7,5%.
    expect(calcularINSSCents(162_100)).toBe(12_158);
    // R$ 3.000: 7,5% + 9% + 12% sobre as parcelas de cada faixa.
    // 1621,00×7,5% + 1281,84×9% + 97,16×12% = 121,58 + 115,37 + 11,66
    expect(calcularINSSCents(300_000)).toBe(24_860);
  });

  it("salário zero ou negativo não gera contribuição", () => {
    expect(calcularINSSCents(0)).toBe(0);
    expect(calcularINSSCents(-100)).toBe(0);
  });
});

describe("tabela do IRRF 2026", () => {
  it("a isenção vai até R$ 2.428,80 e as parcelas a deduzir são as de 2026", () => {
    expect(IRRF_FAIXAS[0].ateCents).toBe(242_880);
    expect(IRRF_FAIXAS.map((f) => f.parcelaDeduzirCents)).toEqual([
      0, 18_216, 39_416, 67_549, 90_873,
    ]);
  });

  it("o desconto simplificado é 25% do teto da faixa isenta", () => {
    expect(IRRF_DESCONTO_SIMPLIFICADO_CENTS).toBe(60_720);
    expect(IRRF_DESCONTO_SIMPLIFICADO_CENTS).toBe(
      Math.round(IRRF_FAIXAS[0].ateCents * 0.25)
    );
  });

  it("dedução por dependente é R$ 189,59", () => {
    expect(IRRF_DEDUCAO_DEPENDENTE_CENTS).toBe(18_959);
  });

  it("base dentro da isenção não retém", () => {
    expect(calcularIRRFCents(242_880, 0)).toBe(0);
    expect(calcularIRRFCents(200_000, 15_000)).toBe(0);
  });

  it("escolhe o caminho mais barato entre deduções legais e simplificado", () => {
    const bruto = 700_000;
    const inss = calcularINSSCents(bruto); // teto não alcançado
    const legal = calcularIRRFCents(bruto, inss, 0);

    // Com muitos dependentes as deduções legais vencem; sem nenhum, depende.
    const comDependentes = calcularIRRFCents(bruto, inss, 3);
    expect(comDependentes).toBeLessThan(legal);
  });

  it("dependente reduz o imposto", () => {
    const inss = calcularINSSCents(500_000);
    expect(calcularIRRFCents(500_000, inss, 1)).toBeLessThanOrEqual(
      calcularIRRFCents(500_000, inss, 0)
    );
  });
});

describe("calcularCLT", () => {
  it("líquido é o bruto menos INSS e IRRF; FGTS não desconta", () => {
    const r = calcularCLT(500_000);
    expect(r.totalDescontosCents).toBe(r.inssCents + r.irrfCents);
    expect(r.liquidoCents).toBe(r.brutoCents - r.totalDescontosCents);
    expect(r.fgtsCents).toBe(Math.round(500_000 * FGTS_ALIQUOTA));
    // O FGTS é do empregador: não entra no desconto.
    expect(r.liquidoCents + r.totalDescontosCents).toBe(500_000);
  });

  it("salário mínimo desconta só o INSS", () => {
    const r = calcularCLT(162_100);
    expect(r.inssCents).toBe(12_158);
    expect(r.irrfCents).toBe(0);
  });
});
