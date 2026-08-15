/**
 * Constantes de navegação do shell (header/sidebar).
 */

/** Rotas que exibem o seletor de mês no header em vez de um título fixo. */
export const ROTAS_COM_MES = new Set(["/mes", "/lancamentos"]);

/** Título exibido no header para cada rota. */
export const TITULOS_PAGINA: Record<string, string> = {
  "/receitas": "Receitas",
  "/custo-de-vida": "Custo de vida",
  "/cartoes": "Cartões de crédito",
  "/extrato": "Extrato",
  "/dividas": "Dívidas",
  "/contas": "Contas",
  "/categorias": "Categorias",
  "/personas": "Personas",
  "/analise": "Análise",
  "/empresas": "Empresas",
  "/ia": "IA",
  "/perfil": "Perfil",
  "/investimentos": "Investimentos",
  "/configuracoes": "Configurações",
};
