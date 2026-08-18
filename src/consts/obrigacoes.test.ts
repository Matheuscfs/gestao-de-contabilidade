import { describe, expect, it } from "vitest";
import {
  ajustarParaDiaUtil,
  calcularVencimento,
  competenciasNaJanela,
  obrigacoesAplicaveis,
  obterObrigacao,
} from "./obrigacoes";
import { validarCNPJ, validarCPF } from "@/utils/documento";

describe("ajustarParaDiaUtil", () => {
  it("mantém dia útil comum", () => {
    // 2026-08-20 é quinta-feira
    expect(ajustarParaDiaUtil("2026-08-20", "POSTERGA")).toBe("2026-08-20");
  });

  it("posterga sábado para segunda", () => {
    // 2026-08-15 é sábado
    expect(ajustarParaDiaUtil("2026-08-15", "POSTERGA")).toBe("2026-08-17");
  });

  it("antecipa sábado para sexta", () => {
    expect(ajustarParaDiaUtil("2026-08-15", "ANTECIPA")).toBe("2026-08-14");
  });

  it("pula feriado nacional", () => {
    // 07/09/2026 (Independência) cai numa segunda-feira
    expect(ajustarParaDiaUtil("2026-09-07", "POSTERGA")).toBe("2026-09-08");
    expect(ajustarParaDiaUtil("2026-09-07", "ANTECIPA")).toBe("2026-09-04");
  });

  it("não mexe quando o modo é NENHUM", () => {
    expect(ajustarParaDiaUtil("2026-08-15", "NENHUM")).toBe("2026-08-15");
  });
});

describe("calcularVencimento", () => {
  const das = obterObrigacao("DAS")!;
  const defis = obterObrigacao("DEFIS")!;
  const irpjTri = obterObrigacao("IRPJ_CSLL_TRI")!;

  it("DAS: dia 20 do mês seguinte à competência", () => {
    expect(calcularVencimento(das, 7, 2026)).toBe("2026-08-20");
  });

  it("DAS: posterga quando o dia 20 cai no domingo", () => {
    // competência ago/2026 → 20/09/2026 é domingo → segunda 21/09
    expect(calcularVencimento(das, 8, 2026)).toBe("2026-09-21");
  });

  it("DEFIS: 31/03 do ano seguinte ao de apuração", () => {
    expect(calcularVencimento(defis, 12, 2025)).toBe("2026-03-31");
  });

  it("IRPJ/CSLL trimestral: último dia do mês seguinte ao trimestre, antecipado a dia útil", () => {
    // 2º tri 2026 → 31/07/2026 (sexta-feira, útil)
    expect(calcularVencimento(irpjTri, 6, 2026)).toBe("2026-07-31");
  });
});

describe("competenciasNaJanela", () => {
  const das = obterObrigacao("DAS")!;
  const hoje = new Date(2026, 7, 3); // 03/08/2026

  it("mensal: janela de 4 competências", () => {
    const comps = competenciasNaJanela(das, hoje, null);
    expect(comps).toContainEqual({ mes: 8, ano: 2026 });
    expect(comps).toContainEqual({ mes: 5, ano: 2026 });
    expect(comps).toHaveLength(4);
  });

  it("respeita a data de abertura da empresa", () => {
    const comps = competenciasNaJanela(das, hoje, "2026-07-10");
    expect(comps).toEqual([
      { mes: 8, ano: 2026 },
      { mes: 7, ano: 2026 },
    ]);
  });

  it("anual: apuração do ano anterior, se a empresa já existia", () => {
    const defis = obterObrigacao("DEFIS")!;
    expect(competenciasNaJanela(defis, hoje, null)).toEqual([
      { mes: 12, ano: 2025 },
    ]);
    expect(competenciasNaJanela(defis, hoje, "2026-02-01")).toEqual([]);
  });
});

describe("vigência (reforma tributária)", () => {
  it("PIS/Cofins não gera competências a partir de 2027", () => {
    const pis = obterObrigacao("PIS_COFINS")!;
    // Em mar/2027 a janela mensal cobre dez/2026–mar/2027: só dez/2026 sobrevive.
    const comps = competenciasNaJanela(pis, new Date(2027, 2, 10), null);
    expect(comps).toEqual([{ mes: 12, ano: 2026 }]);
    // Em jun/2027 nada mais.
    expect(competenciasNaJanela(pis, new Date(2027, 5, 10), null)).toEqual([]);
  });

  it("CBS só existe a partir da competência jan/2027", () => {
    const cbs = obterObrigacao("CBS_MENSAL")!;
    expect(competenciasNaJanela(cbs, new Date(2026, 7, 3), null)).toEqual([]);
    // Ordem da janela: da competência mais recente para a mais antiga.
    const comps = competenciasNaJanela(cbs, new Date(2027, 1, 10), null);
    expect(comps).toEqual([
      { mes: 2, ano: 2027 },
      { mes: 1, ano: 2027 },
    ]);
  });

  it("apuração assistida do IBS/CBS já vale em 2026 para o regime regular", () => {
    const apuracao = obterObrigacao("APURACAO_IBS_CBS")!;
    expect(
      apuracao.aplica({
        regime: "PRESUMIDO",
        temFuncionarios: false,
        temProLabore: false,
      })
    ).toBe(true);
    expect(
      competenciasNaJanela(apuracao, new Date(2026, 7, 3), null).length
    ).toBeGreaterThan(0);
  });

  it("Simples só apura IBS/CBS por fora se optar pelo híbrido ou regular", () => {
    const cbs = obterObrigacao("CBS_MENSAL")!;
    const base = {
      regime: "SIMPLES" as const,
      temFuncionarios: false,
      temProLabore: false,
    };
    expect(cbs.aplica(base)).toBe(false);
    expect(cbs.aplica({ ...base, regimeIbsCbs: "SIMPLES_DAS" })).toBe(false);
    expect(cbs.aplica({ ...base, regimeIbsCbs: "SIMPLES_HIBRIDO" })).toBe(true);
    expect(cbs.aplica({ ...base, regimeIbsCbs: "REGULAR" })).toBe(true);
  });
});

describe("obrigacoesAplicaveis", () => {
  it("Simples sem folha: só as obrigações do regime", () => {
    const codigos = obrigacoesAplicaveis({
      regime: "SIMPLES",
      temFuncionarios: false,
      temProLabore: false,
    }).map((o) => o.codigo);
    expect(codigos).toEqual(["PGDAS_D", "DAS", "DEFIS"]);
  });

  it("Simples com pró-labore: entra a folha, menos FGTS (sócio não tem)", () => {
    const codigos = obrigacoesAplicaveis({
      regime: "SIMPLES",
      temFuncionarios: false,
      temProLabore: true,
    }).map((o) => o.codigo);
    expect(codigos).toContain("ESOCIAL_FOLHA");
    expect(codigos).toContain("DCTFWEB");
    expect(codigos).toContain("INSS_DARF");
    expect(codigos).not.toContain("FGTS_DIGITAL");
  });

  it("Simples com funcionários: FGTS Digital entra", () => {
    const codigos = obrigacoesAplicaveis({
      regime: "SIMPLES",
      temFuncionarios: true,
      temProLabore: false,
    }).map((o) => o.codigo);
    expect(codigos).toContain("FGTS_DIGITAL");
  });

  it("Presumido sem folha: DCTFWeb/MIT entra mesmo assim", () => {
    const codigos = obrigacoesAplicaveis({
      regime: "PRESUMIDO",
      temFuncionarios: false,
      temProLabore: false,
    }).map((o) => o.codigo);
    expect(codigos).toContain("DCTFWEB");
    expect(codigos).toContain("PIS_COFINS");
    expect(codigos).toContain("ECF");
    expect(codigos).not.toContain("DAS");
  });

  it("MEI: DAS-MEI e DASN-SIMEI", () => {
    const codigos = obrigacoesAplicaveis({
      regime: "MEI",
      temFuncionarios: false,
      temProLabore: false,
    }).map((o) => o.codigo);
    expect(codigos).toEqual(["DAS_MEI", "DASN_SIMEI"]);
  });
});

describe("documentos", () => {
  it("valida CNPJ com dígitos verificadores corretos", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("11222333000181")).toBe(true);
    expect(validarCNPJ("11.222.333/0001-80")).toBe(false);
    expect(validarCNPJ("00000000000000")).toBe(false);
    expect(validarCNPJ("123")).toBe(false);
  });

  it("valida CPF com dígitos verificadores corretos", () => {
    expect(validarCPF("529.982.247-25")).toBe(true);
    expect(validarCPF("52998224725")).toBe(true);
    expect(validarCPF("529.982.247-24")).toBe(false);
    expect(validarCPF("11111111111")).toBe(false);
    expect(validarCPF("123")).toBe(false);
  });
});

describe("calcularVencimento com dia municipal", () => {
  const iss = obterObrigacao("ISS_MENSAL")!;

  it("sem override usa o dia do catálogo", () => {
    // ISS de jul/2026 vence em ago/2026, dia 10 (sexta-feira).
    expect(calcularVencimento(iss, 7, 2026)).toBe("2026-08-10");
  });

  it("o município manda quando o dia é informado", () => {
    expect(calcularVencimento(iss, 7, 2026, 15)).toBe("2026-08-17");
    expect(calcularVencimento(iss, 7, 2026, 5)).toBe("2026-08-05");
  });

  it("dia inválido cai de volta no catálogo em vez de gerar data quebrada", () => {
    expect(calcularVencimento(iss, 7, 2026, 0)).toBe(calcularVencimento(iss, 7, 2026));
    expect(calcularVencimento(iss, 7, 2026, 45)).toBe(calcularVencimento(iss, 7, 2026));
    expect(calcularVencimento(iss, 7, 2026, null)).toBe(calcularVencimento(iss, 7, 2026));
  });

  it("dia 31 em mês curto encolhe para o último dia, e daí posterga", () => {
    // Competência jan/2026 vence em fev/2026, que tem 28 dias: o dia 31 vira
    // 28/02, um sábado, e o ISS posterga para a segunda seguinte.
    expect(calcularVencimento(iss, 1, 2026, 31)).toBe("2026-03-02");
  });

  it("o ajuste para dia útil continua valendo sobre o dia do município", () => {
    // 2026-08-15 é sábado; ISS posterga para o dia útil seguinte.
    expect(calcularVencimento(iss, 7, 2026, 15)).toBe("2026-08-17");
  });
});
