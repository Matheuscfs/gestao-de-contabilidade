import { describe, expect, it } from "vitest";
import {
  aplicarRedutorIR,
  calcularFatorR,
  calcularPresumidoMes,
  calcularPresumidoTrimestre,
  calcularProLabore,
  calcularSimples,
  MEI_INSS_CENTS,
} from "./tributos";

describe("calcularSimples", () => {
  it("Anexo III, 2ª faixa: alíquota efetiva e DAS", () => {
    // RBT12 R$ 210.000 → (210.000 × 11,2% − 9.360) / 210.000 = 6,742857%
    const r = calcularSimples("III", 21_000_000, 2_000_000);
    expect(r.faixa).toBe(2);
    expect(r.aliquotaEfetiva).toBeCloseTo(0.06742857, 6);
    // DAS sobre R$ 20.000 → R$ 1.348,57
    expect(r.dasEstimadoCents).toBe(134_857);
    expect(r.acimaDoSublimite).toBe(false);
  });

  it("empresa nova (RBT12 zerado) usa a alíquota nominal da 1ª faixa", () => {
    const r = calcularSimples("III", 0, 1_000_000);
    expect(r.aliquotaEfetiva).toBe(0.06);
    expect(r.dasEstimadoCents).toBe(60_000);
  });

  it("Anexo I, 1ª faixa: efetiva = nominal (4%)", () => {
    const r = calcularSimples("I", 10_000_000, 1_000_000);
    expect(r.aliquotaEfetiva).toBeCloseTo(0.04, 6);
    expect(r.faixa).toBe(1);
  });

  it("sinaliza sublimite e limite", () => {
    const r = calcularSimples("I", 400_000_000, 0);
    expect(r.acimaDoSublimite).toBe(true);
    expect(r.acimaDoLimite).toBe(false);
    expect(calcularSimples("I", 500_000_000, 0).acimaDoLimite).toBe(true);
  });
});

describe("calcularFatorR", () => {
  it("folha ≥ 28% do RBT12 indica o Anexo III", () => {
    expect(calcularFatorR(6_300_000, 21_000_000).anexoIndicado).toBe("III");
    // exatamente 28% ainda é Anexo III
    expect(calcularFatorR(5_880_000, 21_000_000).anexoIndicado).toBe("III");
  });

  it("folha abaixo de 28% indica o Anexo V", () => {
    const r = calcularFatorR(2_100_000, 21_000_000);
    expect(r.fatorR).toBeCloseTo(0.1, 6);
    expect(r.anexoIndicado).toBe("V");
  });
});

describe("calcularProLabore (2026)", () => {
  it("R$ 5.000: INSS 11% e IRRF zerado pela isenção da Lei 15.270/2025", () => {
    const r = calcularProLabore(500_000, false);
    expect(r.inssCents).toBe(55_000);
    expect(r.irrfCents).toBe(0);
    expect(r.liquidoCents).toBe(445_000);
    expect(r.cppEmpresaCents).toBe(0);
  });

  it("R$ 10.000: INSS limitado ao teto e IRRF integral (sem redutor)", () => {
    const r = calcularProLabore(1_000_000, true);
    // 11% do teto R$ 8.475,55
    expect(r.inssCents).toBe(93_231);
    // desconto simplificado é pior que as deduções legais aqui
    expect(r.irrfCents).toBe(159_761);
    expect(r.cppEmpresaCents).toBe(200_000);
    expect(r.liquidoCents).toBe(1_000_000 - 93_231 - 159_761);
  });
});

describe("aplicarRedutorIR", () => {
  it("zera o imposto até R$ 5.000 de rendimento", () => {
    expect(aplicarRedutorIR(33_515, 500_000)).toBe(0);
  });

  it("reduz parcialmente entre R$ 5.000 e R$ 7.350", () => {
    // redutor em R$ 6.000 = 978,62 − 13,3145% × 6.000 = R$ 179,75
    expect(aplicarRedutorIR(50_000, 600_000)).toBe(50_000 - 17_975);
  });

  it("não reduz acima de R$ 7.350", () => {
    expect(aplicarRedutorIR(50_000, 800_000)).toBe(50_000);
  });
});

describe("Lucro Presumido", () => {
  it("PIS 0,65% e Cofins 3% sobre a receita do mês", () => {
    const r = calcularPresumidoMes(10_000_000);
    expect(r.pisCents).toBe(65_000);
    expect(r.cofinsCents).toBe(300_000);
  });

  it("serviços: presunção 32%, IRPJ com adicional e CSLL 9%", () => {
    // trimestre R$ 300.000 → base 96.000 → IRPJ 14.400 + 10% de 36.000 = 18.000
    const r = calcularPresumidoTrimestre("SERVICOS", 30_000_000);
    expect(r.baseIrpjCents).toBe(9_600_000);
    expect(r.irpjAdicionalCents).toBe(360_000);
    expect(r.irpjCents).toBe(1_800_000);
    expect(r.csllCents).toBe(864_000);
  });

  it("comércio: presunção 8% (IRPJ) e 12% (CSLL), sem adicional abaixo de 60k/tri", () => {
    // trimestre R$ 300.000 → base IRPJ 24.000 (sem adicional), CSLL 36.000
    const r = calcularPresumidoTrimestre("COMERCIO_INDUSTRIA", 30_000_000);
    expect(r.baseIrpjCents).toBe(2_400_000);
    expect(r.irpjAdicionalCents).toBe(0);
    expect(r.irpjCents).toBe(360_000);
    expect(r.baseCsllCents).toBe(3_600_000);
    expect(r.csllCents).toBe(324_000);
  });
});

describe("MEI", () => {
  it("INSS do DAS-MEI = 5% do salário mínimo 2026", () => {
    expect(MEI_INSS_CENTS).toBe(8_105);
  });
});
