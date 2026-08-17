import { describe, expect, it } from "vitest";
import {
  competenciaDe,
  diasDeAtraso,
  diasVencido,
  diferencaEmDias,
  resumirPontualidade,
  statusLancamento,
  totalizar,
  vencimentoDaCompetencia,
  type LancamentoBase,
} from "./financeiro";

const HOJE = "2026-08-17";

function lanc(p: Partial<LancamentoBase> = {}): LancamentoBase {
  return {
    valorCents: 50_000,
    vencimento: "2026-08-10",
    dataPagamento: null,
    valorPagoCents: 0,
    ...p,
  };
}

describe("diferencaEmDias", () => {
  it("conta dias entre datas ISO", () => {
    expect(diferencaEmDias("2026-08-10", "2026-08-17")).toBe(7);
    expect(diferencaEmDias("2026-08-17", "2026-08-10")).toBe(-7);
    expect(diferencaEmDias("2026-08-10", "2026-08-10")).toBe(0);
  });

  it("atravessa virada de mês e de ano sem perder dia", () => {
    expect(diferencaEmDias("2026-12-28", "2027-01-04")).toBe(7);
    // Fevereiro de 2028 é bissexto.
    expect(diferencaEmDias("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("atravessa o horário de verão sem arredondar para 0 ou 2 dias", () => {
    // Datas ISO puras são tratadas em UTC justamente por causa disto.
    expect(diferencaEmDias("2026-10-17", "2026-10-18")).toBe(1);
  });
});

describe("vencimentoDaCompetencia", () => {
  it("usa o dia contratado", () => {
    expect(vencimentoDaCompetencia("2026-08", 10)).toBe("2026-08-10");
    expect(vencimentoDaCompetencia("2026-08", 5)).toBe("2026-08-05");
  });

  it("dia 31 em mês curto cai no último dia, não vaza para o mês seguinte", () => {
    expect(vencimentoDaCompetencia("2026-02", 31)).toBe("2026-02-28");
    expect(vencimentoDaCompetencia("2028-02", 31)).toBe("2028-02-29");
    expect(vencimentoDaCompetencia("2026-04", 31)).toBe("2026-04-30");
  });

  it("dia inválido vira dia 1 em vez de data quebrada", () => {
    expect(vencimentoDaCompetencia("2026-08", 0)).toBe("2026-08-01");
    expect(vencimentoDaCompetencia("2026-08", -3)).toBe("2026-08-01");
  });

  it("competenciaDe monta a chave com dois dígitos", () => {
    expect(competenciaDe(3, 2026)).toBe("2026-03");
    expect(competenciaDe(12, 2026)).toBe("2026-12");
  });
});

describe("statusLancamento", () => {
  it("pago é pago, mesmo tendo vencido antes", () => {
    expect(
      statusLancamento(lanc({ dataPagamento: "2026-08-25" }), HOJE)
    ).toBe("PAGO");
  });

  it("vencimento no futuro é em aberto", () => {
    expect(statusLancamento(lanc({ vencimento: "2026-08-20" }), HOJE)).toBe(
      "EM_ABERTO"
    );
  });

  it("vencendo hoje ainda está em aberto — o atraso começa amanhã", () => {
    expect(statusLancamento(lanc({ vencimento: HOJE }), HOJE)).toBe("EM_ABERTO");
  });

  it("vencido e sem pagamento é atrasado", () => {
    expect(statusLancamento(lanc({ vencimento: "2026-08-16" }), HOJE)).toBe(
      "ATRASADO"
    );
  });
});

describe("dias de atraso", () => {
  it("conta do vencimento até o pagamento", () => {
    expect(
      diasDeAtraso(lanc({ vencimento: "2026-08-10", dataPagamento: "2026-08-13" }))
    ).toBe(3);
  });

  it("pagamento antecipado não vira atraso negativo", () => {
    expect(
      diasDeAtraso(lanc({ vencimento: "2026-08-10", dataPagamento: "2026-08-05" }))
    ).toBe(0);
  });

  it("diasVencido só vale enquanto está em aberto", () => {
    expect(diasVencido(lanc({ vencimento: "2026-08-10" }), HOJE)).toBe(7);
    expect(
      diasVencido(lanc({ vencimento: "2026-08-10", dataPagamento: "2026-08-30" }), HOJE)
    ).toBe(0);
  });
});

describe("resumirPontualidade", () => {
  it("mede só o que já foi pago", () => {
    const r = resumirPontualidade(
      [
        lanc({ vencimento: "2026-05-10", dataPagamento: "2026-05-10" }),
        lanc({ vencimento: "2026-06-10", dataPagamento: "2026-06-15" }),
        lanc({ vencimento: "2026-07-10", dataPagamento: "2026-07-11" }),
        // Em aberto e ainda não vencido: não pode contar como atraso.
        lanc({ vencimento: "2026-09-10" }),
      ],
      HOJE
    );
    expect(r.pagos).toBe(3);
    expect(r.emDia).toBe(1);
    expect(r.atrasados).toBe(2);
    expect(r.mediaDiasAtraso).toBeCloseTo((0 + 5 + 1) / 3, 6);
    expect(r.piorAtrasoDias).toBe(5);
    expect(r.percentualEmDia).toBeCloseTo(1 / 3, 6);
  });

  it("cliente sem histórico é null, não 0% pontual", () => {
    const r = resumirPontualidade([lanc({ vencimento: "2026-09-10" })], HOJE);
    expect(r.percentualEmDia).toBeNull();
    expect(r.pagos).toBe(0);
    expect(r.mediaDiasAtraso).toBe(0);
  });

  it("soma o que está vencido agora", () => {
    const r = resumirPontualidade(
      [
        lanc({ vencimento: "2026-07-10", valorCents: 30_000 }),
        lanc({ vencimento: "2026-08-10", valorCents: 45_000 }),
        lanc({ vencimento: "2026-09-10", valorCents: 99_000 }),
      ],
      HOJE
    );
    expect(r.emAtrasoAgora).toBe(2);
    expect(r.valorEmAtrasoCents).toBe(75_000);
  });
});

describe("totalizar", () => {
  it("separa previsto, liquidado, em aberto e atrasado", () => {
    const t = totalizar(
      [
        lanc({ valorCents: 50_000, dataPagamento: "2026-08-09", valorPagoCents: 50_000 }),
        lanc({ valorCents: 30_000, vencimento: "2026-08-05" }),
        lanc({ valorCents: 20_000, vencimento: "2026-08-28" }),
      ],
      HOJE
    );
    expect(t.previstoCents).toBe(100_000);
    expect(t.liquidadoCents).toBe(50_000);
    expect(t.emAbertoCents).toBe(50_000);
    expect(t.atrasadoCents).toBe(30_000);
  });

  it("liquidado usa o valor pago, não o cobrado", () => {
    // Baixa com desconto: o caixa recebeu menos do que a cobrança dizia.
    const t = totalizar(
      [lanc({ valorCents: 50_000, dataPagamento: "2026-08-10", valorPagoCents: 45_000 })],
      HOJE
    );
    expect(t.previstoCents).toBe(50_000);
    expect(t.liquidadoCents).toBe(45_000);
    expect(t.emAbertoCents).toBe(0);
  });

  it("lista vazia zera tudo sem quebrar", () => {
    expect(totalizar([], HOJE)).toEqual({
      previstoCents: 0,
      liquidadoCents: 0,
      emAbertoCents: 0,
      atrasadoCents: 0,
    });
  });
});
