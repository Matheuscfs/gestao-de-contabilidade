import { describe, expect, it } from "vitest";
import { classificarCnae, digitosCnae, formatarCnae } from "./cnae";

describe("formatação do CNAE", () => {
  it("aceita número cru da Receita e devolve a máscara oficial", () => {
    expect(formatarCnae(8630503)).toBe("8630-5/03");
  });

  it("aceita já formatado sem duplicar separadores", () => {
    expect(formatarCnae("8630-5/03")).toBe("8630-5/03");
  });

  it("preserva o zero à esquerda das divisões 01 a 09", () => {
    expect(formatarCnae("0111301")).toBe("0111-3/01");
    expect(digitosCnae("0111-3/01")).toBe("0111301");
  });

  it("recusa código truncado em vez de completar", () => {
    // Enquadrar por código incompleto acertaria a divisão e erraria a
    // subclasse — que é justamente onde mora a exceção.
    expect(formatarCnae("86305")).toBeNull();
    expect(classificarCnae("86305")).toBeNull();
  });
});

describe("comércio e indústria", () => {
  it("varejo cai no Anexo I", () => {
    const r = classificarCnae("4781-4/00")!;
    expect(r.anexoSugerido).toBe("I");
    expect(r.sujeitoFatorR).toBe(false);
    expect(r.atividadePresumido).toBe("COMERCIO_INDUSTRIA");
  });

  it("indústria de alimentos cai no Anexo II", () => {
    expect(classificarCnae("1091-1/02")!.anexoSugerido).toBe("II");
  });

  it("divisão 33 é serviço de manutenção, não indústria", () => {
    // Fica dentro da seção C do CNAE, mas a LC 123 §5º-B IX manda pro III.
    const r = classificarCnae("3314-7/10")!;
    expect(r.anexoSugerido).toBe("III");
    expect(r.sujeitoFatorR).toBe(false);
    expect(r.atividadePresumido).toBe("SERVICOS");
  });

  it("representação comercial não vira comércio por morar na divisão 46", () => {
    const r = classificarCnae("4611-7/00")!;
    expect(r.anexoSugerido).toBe("III");
    expect(r.sujeitoFatorR).toBe(true);
  });
});

describe("Anexo IV — §5º-C, CPP fora do DAS", () => {
  it("construção de edifícios", () => {
    const r = classificarCnae("4120-4/00")!;
    expect(r.anexoSugerido).toBe("IV");
    expect(r.sujeitoFatorR).toBe(false);
  });

  it("advocacia", () => {
    expect(classificarCnae("6911-7/01")!.anexoSugerido).toBe("IV");
  });

  it("vigilância e limpeza", () => {
    expect(classificarCnae("8011-1/01")!.anexoSugerido).toBe("IV");
    expect(classificarCnae("8121-4/00")!.anexoSugerido).toBe("IV");
  });

  it("Anexo IV nunca é sujeito ao Fator R", () => {
    for (const c of ["4120-4/00", "6911-7/01", "8011-1/01", "8121-4/00", "8130-3/00"]) {
      expect(classificarCnae(c)!.sujeitoFatorR).toBe(false);
    }
  });
});

describe("sujeitas ao Fator R — §5º-D", () => {
  it("medicina ambulatorial", () => {
    const r = classificarCnae("8630-5/03")!;
    expect(r.sujeitoFatorR).toBe(true);
    expect(r.anexoSugerido).toBe("III");
    expect(r.fundamento).toContain("§5º-D");
  });

  it("odontologia, laboratório e fisioterapia", () => {
    expect(classificarCnae("8630-5/04")!.sujeitoFatorR).toBe(true);
    expect(classificarCnae("8640-2/02")!.sujeitoFatorR).toBe(true);
    expect(classificarCnae("8650-0/04")!.sujeitoFatorR).toBe(true);
  });

  it("desenvolvimento de software e engenharia", () => {
    expect(classificarCnae("6201-5/01")!.sujeitoFatorR).toBe(true);
    expect(classificarCnae("7112-0/00")!.sujeitoFatorR).toBe(true);
  });

  it("publicidade e consultoria em gestão", () => {
    expect(classificarCnae("7311-4/00")!.sujeitoFatorR).toBe(true);
    expect(classificarCnae("7020-4/00")!.sujeitoFatorR).toBe(true);
  });
});

describe("Anexo III por atividade — §5º-B, sem Fator R", () => {
  it("escritório de serviços contábeis", () => {
    // O caso que motivou a correção: o app avisava "Fator R indica o Anexo V"
    // para quem tem o III garantido por lei.
    const r = classificarCnae("6920-6/01")!;
    expect(r.anexoSugerido).toBe("III");
    expect(r.sujeitoFatorR).toBe(false);
    expect(r.fundamento).toContain("§5º-B");
  });

  it("creche, agência de viagem e autoescola", () => {
    expect(classificarCnae("8511-2/00")!.sujeitoFatorR).toBe(false);
    expect(classificarCnae("7911-2/00")!.sujeitoFatorR).toBe(false);
    expect(classificarCnae("8599-6/01")!.sujeitoFatorR).toBe(false);
  });

  it("transporte municipal de passageiros usa a presunção de transporte", () => {
    const r = classificarCnae("4921-3/01")!;
    expect(r.anexoSugerido).toBe("III");
    expect(r.sujeitoFatorR).toBe(false);
    expect(r.atividadePresumido).toBe("TRANSPORTE_PASSAGEIROS");
  });

  it("corretagem de seguros", () => {
    expect(classificarCnae("6622-3/00")!.sujeitoFatorR).toBe(false);
  });
});

describe("prefixo mais específico vence o mais genérico", () => {
  it("ensino de dança é academia (Fator R), o resto do ensino não é", () => {
    expect(classificarCnae("8592-9/01")!.sujeitoFatorR).toBe(true);
    expect(classificarCnae("8592-9/03")!.sujeitoFatorR).toBe(false);
  });

  it("ensino de esportes é Fator R, ensino médio não", () => {
    expect(classificarCnae("8591-1/00")!.sujeitoFatorR).toBe(true);
    expect(classificarCnae("8520-1/00")!.sujeitoFatorR).toBe(false);
  });
});

describe("CNAE desconhecido", () => {
  it("devolve null em vez de chutar um anexo", () => {
    // Atividade financeira (divisão 64) não está em nenhum rol daqui — e
    // devolver "III" por padrão colocaria a empresa na alíquota errada.
    expect(classificarCnae("6499-9/99")).toBeNull();
    expect(classificarCnae("")).toBeNull();
    expect(classificarCnae(null)).toBeNull();
  });
});
