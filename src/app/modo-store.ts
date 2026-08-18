/**
 * Modo do app: finanças pessoais ou contabilidade.
 *
 * São duas rotinas que não se misturam no dia a dia — conferir a fatura do
 * cartão e fechar o DAS de 24 clientes não acontecem na mesma hora. O modo
 * troca a sidebar inteira em vez de empilhar 14 ícones, e fica gravado para o
 * app abrir onde o usuário estava.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Modo = "pessoal" | "contabil";

/** Prefixo de rota → modo a que ela pertence. Usado para sincronizar ao navegar. */
const ROTAS_CONTABEIS = ["/empresas", "/kanban", "/fluxos", "/financeiro"];

export function modoDaRota(pathname: string): Modo | null {
  if (ROTAS_CONTABEIS.some((r) => pathname.startsWith(r))) return "contabil";
  return null;
}

type EstadoModo = {
  modo: Modo;
  definirModo: (modo: Modo) => void;
};

export const useModoStore = create<EstadoModo>()(
  persist(
    (set) => ({
      modo: "pessoal",
      definirModo: (modo) => set({ modo }),
    }),
    { name: "gestao-contabilidade:modo" }
  )
);
