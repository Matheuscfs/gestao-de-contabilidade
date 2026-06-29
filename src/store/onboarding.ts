import { create } from "zustand";
import { getSetting, setSetting } from "@/core/db/settings";
import { usePerfilStore, inicializarPerfil } from "@/app/perfil-store";
import { tratarErro } from "@/core/errors";

export type ProvedorIA = "openai" | "anthropic" | "gemini" | "openrouter" | null;
export type TomIA = "direto" | "gentil" | "didatico";
export type Foco = "reserva" | "dividas" | "objetivo";

const CHAVE_ONBOARDING = "onboarding_done";

interface OnboardingState {
  nome: string;
  foto: string | null;
  provedorIA: ProvedorIA;
  focos: Foco[];
  focoFrase: string;
  tomIA: TomIA;
  puxarOrelha: boolean;
  comemorarVitorias: boolean;
  contextoIA: string;

  setNome: (nome: string) => void;
  setFoto: (foto: string | null) => void;
  setProvedorIA: (provedor: ProvedorIA) => void;
  setFocos: (focos: Foco[]) => void;
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
  focos: [],
  focoFrase: "",
  tomIA: "direto",
  puxarOrelha: true,
  comemorarVitorias: true,
  contextoIA: "",

  setNome: (nome) => set({ nome }),
  setFoto: (foto) => set({ foto }),
  setProvedorIA: (provedorIA) => set({ provedorIA }),
  setFocos: (focos) => set({ focos }),
  setFocoFrase: (focoFrase) => set({ focoFrase }),
  setTomIA: (tomIA) => set({ tomIA }),
  setPuxarOrelha: (puxarOrelha) => set({ puxarOrelha }),
  setComemorarVitorias: (comemorarVitorias) => set({ comemorarVitorias }),
  setContextoIA: (contextoIA) => set({ contextoIA }),

  concluirOnboarding: async () => {
    const { nome, foto } = get();

    try {
      await setSetting(CHAVE_ONBOARDING, "true");

      const perfil = usePerfilStore.getState();
      if (nome.trim()) await perfil.atualizarNome(nome.trim());
      if (foto) await perfil.atualizarFoto(foto);

      localStorage.setItem("quibo:onboarding_done", "true");
    } catch (e) {
      // Não prende o usuário no onboarding nesta sessão, mas avisa que o
      // banco falhou — antes esse erro era engolido em silêncio.
      localStorage.setItem("quibo:onboarding_done", "true");
      tratarErro(e, {
        contexto: "persistir conclusão do onboarding",
        mensagemUsuario:
          "Concluímos a configuração, mas houve um problema ao salvar seus dados no banco.",
      });
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
