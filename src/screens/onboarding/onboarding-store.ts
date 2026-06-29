import { create } from "zustand";
import { getSetting, setSetting } from "@/core/db/settings";
import { usePerfilStore, inicializarPerfil } from "@/app/perfil-store";

export type ProvedorIA = "openai" | "anthropic" | "gemini" | null;
export type TomIA = "direto" | "gentil" | "didatico";
export type Foco = "reserva" | "dividas" | "objetivo" | "consciencia" | null;

const CHAVE_ONBOARDING = "onboarding_done";

interface OnboardingState {
  nome: string;
  foto: string | null;
  provedorIA: ProvedorIA;
  foco: Foco;
  focoFrase: string;
  tomIA: TomIA;
  puxarOrelha: boolean;
  comemorarVitorias: boolean;
  contextoIA: string;

  setNome: (nome: string) => void;
  setFoto: (foto: string | null) => void;
  setProvedorIA: (provedor: ProvedorIA) => void;
  setFoco: (foco: Foco) => void;
  setFocoFrase: (frase: string) => void;
  setTomIA: (tom: TomIA) => void;
  setPuxarOrelha: (value: boolean) => void;
  setComemorarVitorias: (value: boolean) => void;
  setContextoIA: (contexto: string) => void;

  concluirOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  nome: "",
  foto: null,
  provedorIA: null,
  foco: null,
  focoFrase: "",
  tomIA: "direto",
  puxarOrelha: true,
  comemorarVitorias: true,
  contextoIA: "",

  setNome: (nome) => set({ nome }),
  setFoto: (foto) => set({ foto }),
  setProvedorIA: (provedorIA) => set({ provedorIA }),
  setFoco: (foco) => set({ foco }),
  setFocoFrase: (focoFrase) => set({ focoFrase }),
  setTomIA: (tomIA) => set({ tomIA }),
  setPuxarOrelha: (puxarOrelha) => set({ puxarOrelha }),
  setComemorarVitorias: (comemorarVitorias) => set({ comemorarVitorias }),
  setContextoIA: (contextoIA) => set({ contextoIA }),

  concluirOnboarding: async () => {
    const { nome, foto } = get();

    await setSetting(CHAVE_ONBOARDING, "true");
    localStorage.setItem("quibo:onboarding_done", "true");

    const perfil = usePerfilStore.getState();
    if (nome.trim()) {
      await perfil.atualizarNome(nome.trim());
    }
    if (foto) {
      await perfil.atualizarFoto(foto);
    }
  },
}));

/**
 * Lê o estado de onboarding e o perfil do banco SQLite, sincronizando o localStorage.
 * Se o banco foi apagado (make clear), o localStorage é limpo automaticamente.
 * Deve ser chamada uma única vez antes de renderizar o app.
 */
export async function inicializarOnboarding(): Promise<void> {
  const concluido = await getSetting(CHAVE_ONBOARDING);

  if (concluido === "true") {
    localStorage.setItem("quibo:onboarding_done", "true");
    await inicializarPerfil();
  } else {
    localStorage.removeItem("quibo:onboarding_done");
    localStorage.removeItem("quibo:nome_usuario");
    localStorage.removeItem("quibo:foto_usuario");
  }
}

export function onboardingConcluido(): boolean {
  return localStorage.getItem("quibo:onboarding_done") === "true";
}

export function nomeSalvo(): string {
  return localStorage.getItem("quibo:nome_usuario") ?? "";
}
