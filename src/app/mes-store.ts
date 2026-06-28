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

const agora = new Date();

export const useMesStore = create<MesState>((set) => ({
  mes: agora.getMonth() + 1,
  ano: agora.getFullYear(),

  irParaMesAnterior: () =>
    set((state) => mesAnterior(state.mes, state.ano)),

  irParaProximoMes: () =>
    set((state) => proximoMes(state.mes, state.ano)),

  irParaMes: (mes, ano) => set({ mes, ano }),
}));
