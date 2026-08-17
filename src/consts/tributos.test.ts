import { describe, expect, it } from "vitest";
import {
  aplicarRedutorIR,
  calcularFatorR,
  calcularPresumidoMes,
  calcularPresumidoTrimestre,
  calcularProLabore,
  estimarFolha12m,
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

describe("estimarFolha12m", () => {
  it("pró-labore puro: 12 meses + 13º, sem FGTS nem terço de férias", () => {
    // Sócio com R$ 3.000/mês numa empresa do Anexo III (CPP dentro do DAS).
    const f = estimarFolha12m({
      proLaboreMensalCents: 300_000,
      salariosMensalCents: 0,
      cppForaDoDas: false,
    });
    expect(f.remuneracoesCents).toBe(3_600_000);
    expect(f.decimoTerceiroCents).toBe(300_000);
    // Pró-labore não gera FGTS nem férias.
    expect(f.tercoFeriasCents).toBe(0);
    expect(f.fgtsCents).toBe(0);
    expect(f.cppCents).toBe(0);
    expect(f.totalCents).toBe(3_900_000);
  });

  it("salário celetista soma 13º, terço de férias e FGTS", () => {
    const f = estimarFolha12m({
      proLaboreMensalCents: 0,
      salariosMensalCents: 300_000,
      cppForaDoDas: false,
    });
    expect(f.remuneracoesCents).toBe(3_600_000);
    expect(f.decimoTerceiroCents).toBe(300_000);
    expect(f.tercoFeriasCents).toBe(100_000);
    // 8% sobre 13 salários + terço = (3.900.000 + 100.000) × 0,08
    expect(f.fgtsCents).toBe(320_000);
    expect(f.totalCents).toBe(4_320_000);
  });

  it("CPP entra só quando é recolhida por fora do DAS", () => {
    const base = { proLaboreMensalCents: 300_000, salariosMensalCents: 0 };
    const dentro = estimarFolha12m({ ...base, cppForaDoDas: false });
    const fora = estimarFolha12m({ ...base, cppForaDoDas: true });

    expect(dentro.cppCents).toBe(0);
    // 20% sobre 13 retiradas
    expect(fora.cppCents).toBe(780_000);
    expect(fora.totalCents).toBeGreaterThan(dentro.totalCents);
  });

  it("corrige a subestimação de ~16% da conta antiga", () => {
    const antiga = (300_000 + 200_000) * 12; // remunerações × 12
    const nova = estimarFolha12m({
      proLaboreMensalCents: 300_000,
      salariosMensalCents: 200_000,
      cppForaDoDas: false,
    }).totalCents;

    expect(nova).toBeGreaterThan(antiga);
    const ganho = nova / antiga - 1;
    expect(ganho).toBeGreaterThan(0.1);
    expect(ganho).toBeLessThan(0.2);
  });

  it("folha zerada não inventa valor", () => {
    const f = estimarFolha12m({
      proLaboreMensalCents: 0,
      salariosMensalCents: 0,
      cppForaDoDas: true,
    });
    expect(f.totalCents).toBe(0);
  });

  it("a diferença muda o anexo indicado numa empresa de fronteira", () => {
    // RBT12 de R$ 200 mil com pró-labore de R$ 4.500/mês. A conta antiga dá
    // 27,0% e joga no Anexo V; somando o 13º chega a 29,25% e cai no III.
    // Só de alíquota efetiva isso é 15,75% contra 6,52% — a empresa pagava
    // mais que o dobro por causa de um mês de remuneração esquecido.
    const rbt12 = 20_000_000;
    const proLabore = 450_000;

    const antiga = calcularFatorR(proLabore * 12, rbt12);
    const nova = calcularFatorR(
      estimarFolha12m({
        proLaboreMensalCents: proLabore,
        salariosMensalCents: 0,
        cppForaDoDas: false,
      }).totalCents,
      rbt12
    );

    expect(antiga.anexoIndicado).toBe("V");
    expect(nova.anexoIndicado).toBe("III");
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
    // Base legal 9.067,69 × 27,5% − 908,73 = 1.584,88. O desconto simplificado
    // sai pior aqui, então valem as deduções legais.
    //
    // Este número era 159.761 enquanto `clt.ts` usava a parcela a deduzir de
    // 2025 (896,00 em vez de 908,73) — os R$ 12,73 de diferença iam direto
    // para a guia do sócio.
    expect(r.irrfCents).toBe(158_488);
    expect(r.cppEmpresaCents).toBe(200_000);
    expect(r.liquidoCents).toBe(1_000_000 - 93_231 - 158_488);
  });

  it("retirada abaixo do salário mínimo é sinalizada", () => {
    expect(calcularProLabore(100_000, false).abaixoDoMinimo).toBe(true);
    expect(calcularProLabore(162_100, false).abaixoDoMinimo).toBe(false);
    expect(calcularProLabore(500_000, false).abaixoDoMinimo).toBe(false);
  });

  it("não retirar pró-labore não é irregularidade", () => {
    // Sócio que só investe, sem atuar na gestão, recebe apenas lucros.
    expect(calcularProLabore(0, false).abaixoDoMinimo).toBe(false);
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
