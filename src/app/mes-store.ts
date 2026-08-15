import { materializarOcorrencias } from "@/core/db/ocorrencias";
import { tratarErro } from "@/core/errors";
import { create } from "zustand";

interface MesState {
  mes: number;
  ano: number;
  irParaMesAnterior: () => void;
  irParaProximoMes: () => void;
  irParaMes: (mes: number, ano: number) => void;
}

function mesAnterior(mes: number, ano: number) {
  if (mes === 1) return { mes: 12, ano: ano - 1 };
  return { mes: mes - 1, ano };
}

function proximoMes(mes: number, ano: number) {
  if (mes === 12) return { mes: 1, ano: ano + 1 };
  return { mes: mes + 1, ano };
}

// ─── Materialização da competência ────────────────────────────────────────────
//
// As telas de Mês e Lançamentos leem OCORRÊNCIAS (is_template = 0), que só
// existem depois que o motor as gera a partir dos modelos cadastrados. Por isso
// a troca de mês materializa a competência de destino ANTES de publicar o novo
// mês no store: quando as telas reagem à mudança e vão ao banco, o que elas
// precisam ler já está lá.
//
// Uma falha aqui não pode travar a navegação — o erro é registrado e o mês muda
// do mesmo jeito (a tela apenas mostrará o que já existir).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Garante as ocorrências da competência. Nunca rejeita.
 *
 * @returns quantas ocorrências foram criadas (0 também quando houve erro).
 */
export async function prepararCompetencia(mes: number, ano: number): Promise<number> {
  try {
    return await materializarOcorrencias(mes, ano);
  } catch (e) {
    tratarErro(e, { contexto: "gerar os lançamentos do mês", notificar: false });
    return 0;
  }
}

/**
 * Mês que o usuário pediu por último — pode estar à frente do estado enquanto a
 * materialização ainda roda. Cliques rápidos na seta encadeiam a partir daqui,
 * senão dois cliques seguidos avançariam um mês só.
 */
let alvo: { mes: number; ano: number } | null = null;

const agora = new Date();

export const useMesStore = create<MesState>((set, get) => {
  async function irPara(destino: { mes: number; ano: number }) {
    alvo = destino;
    await prepararCompetencia(destino.mes, destino.ano);
    // Chegou pedido mais novo no meio do caminho: o último clique é que vale.
    if (!alvo || alvo.mes !== destino.mes || alvo.ano !== destino.ano) return;
    alvo = null;
    set(destino);
  }

  /** Base do cálculo: o mês já pedido (ainda em preparo) ou o mês atual. */
  function base() {
    return alvo ?? { mes: get().mes, ano: get().ano };
  }

  return {
    mes: agora.getMonth() + 1,
    ano: agora.getFullYear(),

    irParaMesAnterior: () => {
      const { mes, ano } = base();
      void irPara(mesAnterior(mes, ano));
    },

    irParaProximoMes: () => {
      const { mes, ano } = base();
      void irPara(proximoMes(mes, ano));
    },

    irParaMes: (mes, ano) => {
      void irPara({ mes, ano });
    },
  };
});
