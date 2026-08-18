import { describe, expect, it } from "vitest";

import {
  checklistIndicaZerado,
  normalizarAtividadePresumido,
  normalizarCnpj,
  normalizarCpf,
  normalizarFormaPagamento,
  normalizarRegime,
  normalizarSituacao,
  paraCentavos,
  paraDataISO,
  rotuloAcessoPorLink,
  semAcento,
  separarCidadeUf,
  statusDoChecklist,
  textoOuNulo,
  tipoAcessoPorLink,
} from "./normalizar";

describe("normalizarCnpj", () => {
  it("aceita as três grafias que aparecem na planilha", () => {
    expect(normalizarCnpj("60.045.629/0001-80")).toBe("60045629000180");
    expect(normalizarCnpj("58779389000103.")).toBe("58779389000103");
    // Digitação sem a barra — mesmos 14 dígitos.
    expect(normalizarCnpj("53.499.9420001-22")).toBe("53499942000122");
  });

  it("descarta em vez de consertar o que não tem 14 dígitos", () => {
    expect(normalizarCnpj("")).toBeNull();
    expect(normalizarCnpj("123456")).toBeNull();
    expect(normalizarCnpj("123*Marcelo")).toBeNull();
  });
});

describe("normalizarCpf", () => {
  it("normaliza CPF formatado", () => {
    expect(normalizarCpf("031.932.219-02")).toBe("03193221902");
  });

  it("rejeita a senha e o CPF truncado que existem na coluna CPF", () => {
    expect(normalizarCpf("123*Marcelo")).toBeNull();
    expect(normalizarCpf("36093189-88")).toBeNull();
  });
});

describe("paraCentavos", () => {
  it("converte número do Excel arredondando", () => {
    expect(paraCentavos(1426)).toBe(142600);
    expect(paraCentavos(113.33333333333333)).toBe(11333);
    expect(paraCentavos(90278.34)).toBe(9027834);
  });

  it("entende pt-BR e en-US", () => {
    expect(paraCentavos("1.234,56")).toBe(123456);
    expect(paraCentavos("1,234.56")).toBe(123456);
    expect(paraCentavos("R$ 300")).toBe(30000);
    expect(paraCentavos("44,90")).toBe(4490);
  });

  it("devolve null quando não há número", () => {
    expect(paraCentavos("")).toBeNull();
    expect(paraCentavos(null)).toBeNull();
    expect(paraCentavos("—")).toBeNull();
  });

  it("distingue zero de ausente", () => {
    expect(paraCentavos(0)).toBe(0);
    expect(paraCentavos("0")).toBe(0);
  });
});

describe("paraDataISO", () => {
  it("aceita Date do Excel sem recuar um dia no fuso do Brasil", () => {
    expect(paraDataISO(new Date(Date.UTC(2025, 2, 21)))).toBe("2025-03-21");
  });

  it("aceita texto ISO com hora e formato brasileiro", () => {
    expect(paraDataISO("2025-03-21 00:00:00")).toBe("2025-03-21");
    expect(paraDataISO("21/03/2025")).toBe("2025-03-21");
    expect(paraDataISO("5/3/2025")).toBe("2025-03-05");
  });

  it("devolve null para texto que não é data", () => {
    expect(paraDataISO("")).toBeNull();
    expect(paraDataISO("ATIVA")).toBeNull();
  });
});

describe("normalizarRegime", () => {
  it("mapeia os regimes da planilha", () => {
    expect(normalizarRegime("Simples Nacional")).toBe("SIMPLES");
    expect(normalizarRegime("SIMPLES NACIONAL")).toBe("SIMPLES");
    expect(normalizarRegime("Real")).toBe("REAL");
    expect(normalizarRegime("Presumido")).toBe("PRESUMIDO");
    expect(normalizarRegime("MEI")).toBe("MEI");
  });

  it("devolve null em vez de chutar um regime", () => {
    expect(normalizarRegime("")).toBeNull();
    expect(normalizarRegime("xyz")).toBeNull();
  });
});

describe("normalizarSituacao", () => {
  it("trata ZERADO como ativa sem movimento, não como status próprio", () => {
    expect(normalizarSituacao("ZERADO")).toEqual({
      status: "ATIVA",
      semMovimento: true,
      aConferir: false,
    });
  });

  it("marca a interrogação da planilha para conferência", () => {
    expect(normalizarSituacao("?")).toEqual({
      status: "ATIVA",
      semMovimento: false,
      aConferir: true,
    });
  });

  it("célula vazia vira ATIVA sem pedir conferência", () => {
    expect(normalizarSituacao("")).toEqual({
      status: "ATIVA",
      semMovimento: false,
      aConferir: false,
    });
  });

  it("reconhece baixada e inativa", () => {
    expect(normalizarSituacao("BAIXADA").status).toBe("BAIXADA");
    expect(normalizarSituacao("Inativa").status).toBe("INATIVA");
  });
});

describe("separarCidadeUf", () => {
  it("separa cidade e UF", () => {
    expect(separarCidadeUf("Cascavel - PR")).toEqual({
      municipio: "Cascavel",
      uf: "PR",
    });
    expect(separarCidadeUf("Nova Santa Rosa - PR")).toEqual({
      municipio: "Nova Santa Rosa",
      uf: "PR",
    });
    expect(separarCidadeUf("São Paulo - SP")).toEqual({
      municipio: "São Paulo",
      uf: "SP",
    });
  });

  it("sem UF mantém a cidade inteira", () => {
    expect(separarCidadeUf("Cascavel")).toEqual({
      municipio: "Cascavel",
      uf: null,
    });
    expect(separarCidadeUf("")).toEqual({ municipio: null, uf: null });
  });
});

describe("tipoAcessoPorLink / rotuloAcessoPorLink", () => {
  it("classifica os portais que a planilha usa", () => {
    const cascavel =
      "https://nfse-cascavel.atende.net/autoatendimento/servicos/nfse";
    expect(tipoAcessoPorLink(cascavel)).toBe("NFSE");
    expect(tipoAcessoPorLink("https://www.esnfs.com.br/nfsemissao")).toBe("NFSE");
    expect(tipoAcessoPorLink("https://www.bombeiros.pr.gov.br/PrevFogo")).toBe(
      "BOMBEIROS"
    );
    expect(tipoAcessoPorLink("https://www.empresafacil.pr.gov.br/sigfacil")).toBe(
      "JUNTA"
    );
  });

  it("sem link cai no padrão informado", () => {
    expect(tipoAcessoPorLink("", "GOV_BR")).toBe("GOV_BR");
    expect(tipoAcessoPorLink("")).toBe("OUTRO");
  });

  it("deriva o rótulo pelo município no host da NFSe", () => {
    expect(
      rotuloAcessoPorLink("https://nfse-cascavel.atende.net/servicos/nfse")
    ).toBe("NFSe Cascavel");
    expect(
      rotuloAcessoPorLink("https://nfse-novasantarosa.atende.net/?rot=1")
    ).toBe("NFSe Novasantarosa");
  });
});

describe("normalizarFormaPagamento", () => {
  it("lê parcela, plano e à vista", () => {
    expect(normalizarFormaPagamento("Parcela 9/10")).toEqual({
      tipo: "PARCELA",
      atual: 9,
      total: 10,
    });
    expect(normalizarFormaPagamento("Plano")).toEqual({ tipo: "RECORRENTE" });
    expect(normalizarFormaPagamento("A Vista")).toEqual({ tipo: "A_VISTA" });
  });
});

describe("statusDoChecklist", () => {
  it('"Não Emitido" e a digitação "Não Emito" ficam pendentes', () => {
    expect(statusDoChecklist("Não Emitido")).toBe("PENDENTE");
    expect(statusDoChecklist("Não Emito")).toBe("PENDENTE");
    expect(statusDoChecklist("Não")).toBe("PENDENTE");
  });

  it("emitido/protocolado/sim contam como entregue", () => {
    expect(statusDoChecklist("Emitido")).toBe("ENTREGUE");
    expect(statusDoChecklist("Emitido Zerado")).toBe("ENTREGUE");
    expect(statusDoChecklist("Protocolado")).toBe("ENTREGUE");
    expect(statusDoChecklist("Sim")).toBe("ENTREGUE");
    expect(statusDoChecklist("OK")).toBe("ENTREGUE");
  });

  it('"Sem Retirada" é dispensa: não houve pró-labore no mês', () => {
    expect(statusDoChecklist("Sem Retirada")).toBe("DISPENSADA");
  });

  it("solicitado e X seguem pendentes; vazio não decide nada", () => {
    expect(statusDoChecklist("Solicitado")).toBe("PENDENTE");
    expect(statusDoChecklist("X")).toBe("PENDENTE");
    expect(statusDoChecklist("")).toBeNull();
  });
});

describe("checklistIndicaZerado", () => {
  it("detecta a competência sem movimento", () => {
    expect(checklistIndicaZerado("Emitido Zerado")).toBe(true);
    expect(checklistIndicaZerado("Emitido")).toBe(false);
  });
});

describe("auxiliares de texto", () => {
  it("semAcento remove diacríticos", () => {
    expect(semAcento("Não Emitido")).toBe("Nao Emitido");
    expect(semAcento("COMÉRCIO")).toBe("COMERCIO");
  });

  it("textoOuNulo descarta os placeholders da planilha", () => {
    expect(textoOuNulo("  Cascavel ")).toBe("Cascavel");
    expect(textoOuNulo("-")).toBeNull();
    expect(textoOuNulo("?")).toBeNull();
    expect(textoOuNulo("   ")).toBeNull();
    expect(textoOuNulo(null)).toBeNull();
  });

  it("normalizarAtividadePresumido reconhece as presunções", () => {
    expect(normalizarAtividadePresumido("Comércio de colchões")).toBe(
      "COMERCIO_INDUSTRIA"
    );
    expect(normalizarAtividadePresumido("Prestação de serviços")).toBe(
      "SERVICOS"
    );
    expect(normalizarAtividadePresumido("Transporte de passageiros")).toBe(
      "TRANSPORTE_PASSAGEIROS"
    );
    expect(normalizarAtividadePresumido("")).toBeNull();
  });
});
