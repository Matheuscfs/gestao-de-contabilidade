import { create } from "zustand";
import { getSetting, setSetting, deleteSetting } from "@/core/db/settings";

const CHAVE_NOME = "nome_usuario";
const CHAVE_FOTO = "foto_usuario";

interface PerfilState {
  nome: string;
  foto: string | null;
  iniciais: string;

  atualizarNome: (nome: string) => Promise<void>;
  atualizarFoto: (foto: string | null) => Promise<void>;
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

  atualizarNome: async (nome) => {
    set({ nome, iniciais: calcularIniciais(nome) });
    await setSetting(CHAVE_NOME, nome);
    localStorage.setItem("quibo:nome_usuario", nome);
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
  },
}));

/**
 * Lê nome e foto do banco e popula o store.
 * Chamada uma vez na inicialização do app, antes de renderizar.
 */
export async function inicializarPerfil(): Promise<void> {
  const nome = (await getSetting(CHAVE_NOME)) ?? "";
  const foto = (await getSetting(CHAVE_FOTO)) ?? null;

  usePerfilStore.setState({
    nome,
    foto,
    iniciais: calcularIniciais(nome),
  });

  if (nome) localStorage.setItem("quibo:nome_usuario", nome);
  if (foto) localStorage.setItem("quibo:foto_usuario", foto);
}
