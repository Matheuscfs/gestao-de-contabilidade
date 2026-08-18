import { describe, expect, it } from "vitest";
import { formatarTelefone, interpretarRespostaCnpj } from "./cnpj";

/** Recorte de uma resposta real da BrasilAPI, com os campos que o app usa. */
const RESPOSTA = JSON.stringify({
  cnpj: "19131243000197",
  razao_social: "CLINICA EXEMPLO LTDA",
  nome_fantasia: "CLINICA EXEMPLO",
  data_inicio_atividade: "2019-04-15",
  cnae_fiscal: 8630503,
  cnae_fiscal_descricao: "Atividade médica ambulatorial restrita a consultas",
  cnaes_secundarios: [
    { codigo: 8650004, descricao: "Atividades de fisioterapia" },
    { codigo: 8640202, descricao: "Laboratórios clínicos" },
  ],
  uf: "pr",
  municipio: "CASCAVEL",
  ddd_telefone_1: "4532251234",
  capital_social: 50000.5,
  descricao_situacao_cadastral: "Ativa",
  data_situacao_cadastral: "2019-04-15",
  opcao_pelo_simples: true,
  opcao_pelo_mei: null,
  qsa: [
    {
      nome_socio: "MARIA DE SOUZA",
      cnpj_cpf_do_socio: "***456789**",
      qualificacao_socio: "Sócio-Administrador",
    },
    { nome_socio: "", cnpj_cpf_do_socio: "***111222**" },
  ],
});

describe("interpretarRespostaCnpj", () => {
  const d = interpretarRespostaCnpj(RESPOSTA);

  it("mapeia identificação e endereço", () => {
    expect(d.razaoSocial).toBe("CLINICA EXEMPLO LTDA");
    expect(d.nomeFantasia).toBe("CLINICA EXEMPLO");
    expect(d.dataAbertura).toBe("2019-04-15");
    expect(d.uf).toBe("PR");
    expect(d.municipio).toBe("CASCAVEL");
    expect(d.telefone).toBe("(45) 3225-1234");
  });

  it("formata o CNAE principal e os secundários", () => {
    expect(d.cnaePrincipal).toBe("8630-5/03");
    expect(d.cnaeDescricao).toBe("Atividade médica ambulatorial restrita a consultas");
    expect(d.cnaesSecundarios).toEqual(["8650-0/04", "8640-2/02"]);
  });

  it("converte capital social para centavos sem resíduo de ponto flutuante", () => {
    expect(d.capitalSocialCents).toBe(5_000_050);
  });

  it("deduz o regime pela opção declarada na Receita", () => {
    expect(d.regimeSugerido).toBe("SIMPLES");
  });

  it("enquadra pelo CNAE principal", () => {
    expect(d.enquadramento?.sujeitoFatorR).toBe(true);
    expect(d.enquadramento?.anexoSugerido).toBe("III");
  });

  it("normaliza a situação cadastral para maiúsculas", () => {
    expect(d.situacaoCadastral).toBe("ATIVA");
  });

  it("traz a data da situação — é a data da baixa quando a empresa é baixada", () => {
    expect(d.dataSituacaoCadastral).toBe("2019-04-15");
  });

  it("traz os sócios do QSA e descarta linha sem nome", () => {
    expect(d.socios).toHaveLength(1);
    expect(d.socios[0]).toEqual({
      nome: "MARIA DE SOUZA",
      cpfCnpjMascarado: "***456789**",
      qualificacao: "Sócio-Administrador",
    });
  });
});

describe("respostas incompletas", () => {
  it("empresa recém-aberta, com quase tudo nulo, ainda é utilizável", () => {
    const d = interpretarRespostaCnpj(
      JSON.stringify({
        cnpj: "11222333000181",
        razao_social: "NOVA EMPRESA LTDA",
        nome_fantasia: "",
        cnae_fiscal: null,
        capital_social: null,
        qsa: null,
      })
    );
    expect(d.razaoSocial).toBe("NOVA EMPRESA LTDA");
    expect(d.nomeFantasia).toBeNull();
    expect(d.cnaePrincipal).toBeNull();
    expect(d.enquadramento).toBeNull();
    expect(d.capitalSocialCents).toBe(0);
    expect(d.socios).toEqual([]);
    expect(d.regimeSugerido).toBeNull();
  });

  it("MEI vence a opção pelo Simples", () => {
    const d = interpretarRespostaCnpj(
      JSON.stringify({
        razao_social: "X",
        opcao_pelo_simples: true,
        opcao_pelo_mei: true,
      })
    );
    expect(d.regimeSugerido).toBe("MEI");
  });

  it("resposta sem razão social é erro, não cadastro vazio", () => {
    expect(() => interpretarRespostaCnpj(JSON.stringify({ cnpj: "1" }))).toThrow(
      /sem razão social/
    );
  });

  it("corpo que não é JSON vira erro legível", () => {
    expect(() => interpretarRespostaCnpj("<html>502</html>")).toThrow(/ilegível/);
  });
});

describe("formatarTelefone", () => {
  it("fixo e celular", () => {
    expect(formatarTelefone("4532251234")).toBe("(45) 3225-1234");
    expect(formatarTelefone("45988887777")).toBe("(45) 98888-7777");
  });

  it("quantidade de dígitos fora do padrão vira null", () => {
    expect(formatarTelefone("3225123")).toBeNull();
    expect(formatarTelefone("")).toBeNull();
    expect(formatarTelefone(null)).toBeNull();
  });
});
