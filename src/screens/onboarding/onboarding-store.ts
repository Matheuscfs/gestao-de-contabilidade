import { create } from "zustand";

export type ProvedorIA = "openai" | "anthropic" | "gemini" | null;
export type TomIA = "direto" | "gentil" | "didatico";
export type Foco = "reserva" | "dividas" | "objetivo" | "consciencia" | null;

interface OnboardingState {
  nome: string;
  provedorIA: ProvedorIA;
  foco: Foco;
  focoFrase: string;
  tomIA: TomIA;
  puxarOrelha: boolean;
  comemorarVitorias: boolean;
  contextoIA: string;

  setNome: (nome: string) => void;
  setProvedorIA: (provedor: ProvedorIA) => void;
  setFoco: (foco: Foco) => void;
  setFocoFrase: (frase: string) => void;
  setTomIA: (tom: TomIA) => void;
  setPuxarOrelha: (value: boolean) => void;
  setComemorarVitorias: (value: boolean) => void;
  setContextoIA: (contexto: string) => void;

  concluirOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  nome: "",
  provedorIA: null,
  foco: null,
  focoFrase: "",
  tomIA: "direto",
  puxarOrelha: true,
  comemorarVitorias: true,
  contextoIA: "",

  setNome: (nome) => set({ nome }),
  setProvedorIA: (provedorIA) => set({ provedorIA }),
  setFoco: (foco) => set({ foco }),
  setFocoFrase: (focoFrase) => set({ focoFrase }),
  setTomIA: (tomIA) => set({ tomIA }),
  setPuxarOrelha: (puxarOrelha) => set({ puxarOrelha }),
  setComemorarVitorias: (comemorarVitorias) => set({ comemorarVitorias }),
  setContextoIA: (contextoIA) => set({ contextoIA }),

  concluirOnboarding: () => {
    const { nome } = get();
    localStorage.setItem("quibo:onboarding_done", "true");
    if (nome.trim()) {
      localStorage.setItem("quibo:nome_usuario", nome.trim());
    }
  },
}));

export function onboardingConcluido(): boolean {
  return localStorage.getItem("quibo:onboarding_done") === "true";
}

export function nomeSalvo(): string {
  return localStorage.getItem("quibo:nome_usuario") ?? "";
}
