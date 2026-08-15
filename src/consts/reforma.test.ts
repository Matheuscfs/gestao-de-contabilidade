import { describe, expect, it } from "vitest";
import { FASES_REFORMA, situacaoDaFase } from "./reforma";

describe("linha do tempo da reforma", () => {
  it("cobre 2026 a 2033 sem buracos", () => {
    const anosCobertos = new Set<number>();
    for (const fase of FASES_REFORMA) {
      for (let a = fase.ano; a <= (fase.anoFim ?? fase.ano); a++) {
        anosCobertos.add(a);
      }
    }
    for (let ano = 2026; ano <= 2033; ano++) {
      expect(anosCobertos.has(ano)).toBe(true);
    }
  });

  it("classifica passada/atual/futura em 2026", () => {
    const [f2026, f2027, , f2029a32, f2033] = FASES_REFORMA;
    expect(situacaoDaFase(f2026, 2026)).toBe("ATUAL");
    expect(situacaoDaFase(f2027, 2026)).toBe("FUTURA");
    expect(situacaoDaFase(f2033, 2026)).toBe("FUTURA");
    // Fase plurianual é "atual" em qualquer ano do intervalo.
    expect(situacaoDaFase(f2029a32, 2030)).toBe("ATUAL");
    expect(situacaoDaFase(f2026, 2030)).toBe("PASSADA");
  });
});
