import { create } from "zustand";

/**
 * Store de toasts do Quibo.
 *
 * Vive fora da árvore React (zustand) de propósito: assim qualquer camada —
 * inclusive o tratamento centralizado de erros (`@/core/errors`) e código que
 * não é componente — consegue disparar um aviso sem precisar de hook/contexto.
 *
 * O viewport visual é o `<Toaster />`, montado uma única vez em `main.tsx`.
 */

export type ToastTipo = "sucesso" | "erro" | "aviso" | "info";

export interface Toast {
  id: string;
  tipo: ToastTipo;
  titulo: string;
  descricao?: string;
  /** Duração em ms até o auto-fechamento. 0 = não fecha sozinho. */
  duracao: number;
}

export interface ToastOpcoes {
  descricao?: string;
  duracao?: number;
}

interface ToastState {
  toasts: Toast[];
  adicionar: (toast: Omit<Toast, "id">) => string;
  remover: (id: string) => void;
  limpar: () => void;
}

const DURACAO_PADRAO = 4500;

let contador = 0;
function gerarId(): string {
  contador += 1;
  return `toast-${contador}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  adicionar: (toast) => {
    const id = gerarId();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  remover: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  limpar: () => set({ toasts: [] }),
}));

function disparar(
  tipo: ToastTipo,
  titulo: string,
  opcoes: ToastOpcoes = {}
): string {
  return useToastStore.getState().adicionar({
    tipo,
    titulo,
    descricao: opcoes.descricao,
    duracao: opcoes.duracao ?? DURACAO_PADRAO,
  });
}

/**
 * API imperativa de toasts — use em qualquer lugar, dentro ou fora de React.
 *
 * @example
 * toast.sucesso("Dívida salva");
 * toast.erro("Não foi possível salvar", { descricao: msg });
 */
export const toast = {
  sucesso: (titulo: string, opcoes?: ToastOpcoes) =>
    disparar("sucesso", titulo, opcoes),
  erro: (titulo: string, opcoes?: ToastOpcoes) =>
    disparar("erro", titulo, opcoes),
  aviso: (titulo: string, opcoes?: ToastOpcoes) =>
    disparar("aviso", titulo, opcoes),
  info: (titulo: string, opcoes?: ToastOpcoes) =>
    disparar("info", titulo, opcoes),
  remover: (id: string) => useToastStore.getState().remover(id),
  limpar: () => useToastStore.getState().limpar(),
};
