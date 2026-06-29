import { create } from "zustand";
import { getSetting, setSetting, deleteSetting } from "@/core/db/settings";
import { sincronizarPersonaPrincipal } from "@/core/db/personas";
import type { Foco } from "@/store/onboarding";

const CHAVE_NOME = "nome_usuario";
const CHAVE_FOTO = "foto_usuario";
const CHAVE_FOCOS = "focos_usuario";
const CHAVE_FOCO_FRASE = "foco_frase_usuario";

interface PerfilState {
  nome: string;
  foto: string | null;
  iniciais: string;
  focos: Foco[];
  focoFrase: string;

  atualizarNome: (nome: string) => Promise<void>;
  atualizarFoto: (foto: string | null) => Promise<void>;
  atualizarFocos: (focos: Foco[]) => Promise<void>;
  atualizarFocoFrase: (frase: string) => Promise<void>;
}

function calcularIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

export const usePerfilStore = create<PerfilState>((set) => ({
  nome: "",
  foto: null,
  iniciais: "",
  focos: [],
  focoFrase: "",

  atualizarNome: async (nome) => {
    set({ nome, iniciais: calcularIniciais(nome) });
    await setSetting(CHAVE_NOME, nome);
    localStorage.setItem("quibo:nome_usuario", nome);
    // Mantém a persona principal em sincronia (cria-a no onboarding).
    await sincronizarPersonaPrincipal({ name: nome });
  },

  atualizarFoto: async (foto) => {
    set({ foto });
    if (foto) {
      await setSetting(CHAVE_FOTO, foto);
      localStorage.setItem("quibo:foto_usuario", foto);
    } else {
      await deleteSetting(CHAVE_FOTO);
      localStorage.removeItem("quibo:foto_usuario");
    }
    // Reflete a foto do perfil no avatar da persona principal.
    await sincronizarPersonaPrincipal({ avatar: foto });
  },

  atualizarFocos: async (focos) => {
    set({ focos });
    if (focos.length > 0) {
      await setSetting(CHAVE_FOCOS, JSON.stringify(focos));
    } else {
      await deleteSetting(CHAVE_FOCOS);
    }
  },

  atualizarFocoFrase: async (frase) => {
    set({ focoFrase: frase });
    if (frase.trim()) {
      await setSetting(CHAVE_FOCO_FRASE, frase.trim());
    } else {
      await deleteSetting(CHAVE_FOCO_FRASE);
    }
  },
}));

/**
 * Lê todos os dados de perfil do banco e popula o store.
 * Chamada uma vez na inicialização do app, antes de renderizar.
 */
export async function inicializarPerfil(): Promise<void> {
  const [nome, foto, focosRaw, focoFrase] = await Promise.all([
    getSetting(CHAVE_NOME),
    getSetting(CHAVE_FOTO),
    getSetting(CHAVE_FOCOS),
    getSetting(CHAVE_FOCO_FRASE),
  ]);

  const focos: Foco[] = focosRaw ? (JSON.parse(focosRaw) as Foco[]) : [];

  usePerfilStore.setState({
    nome: nome ?? "",
    foto: foto ?? null,
    iniciais: calcularIniciais(nome ?? ""),
    focos,
    focoFrase: focoFrase ?? "",
  });

  if (nome) localStorage.setItem("quibo:nome_usuario", nome);
  if (foto) localStorage.setItem("quibo:foto_usuario", foto);

  // Garante a persona principal para quem já tinha concluído o onboarding antes
  // dessa funcionalidade existir (cria se faltar, mantém em dia caso já exista).
  if (nome) {
    await sincronizarPersonaPrincipal({ name: nome, avatar: foto ?? null });
  }
}
