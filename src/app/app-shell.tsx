import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "@/app/sidebar";
import { useMesStore } from "@/app/mes-store";
import { formatarMesAno } from "@/utils/dates";

const MONTH_ROUTES = new Set(["/mes", "/lancamentos"]);

const PAGE_TITLES: Record<string, string> = {
  "/receitas": "Receitas",
  "/custo-de-vida": "Custo de vida",
  "/cartoes": "Cartões de crédito",
  "/dividas": "Dívidas",
  "/contas": "Contas",
  "/categorias": "Categorias",
  "/personas": "Personas",
  "/analise": "Análise",
  "/ia": "Quibo IA",
  "/perfil": "Perfil",
  "/investimentos": "Investimentos",
  "/configuracoes": "Configurações",
};

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { mes, ano, irParaMesAnterior, irParaProximoMes } = useMesStore();

  const showMonth = MONTH_ROUTES.has(pathname);
  const title = PAGE_TITLES[pathname] ?? "";

  return (
    <div className="h-full bg-surface-subtle overflow-hidden flex gap-3 p-4">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header — fiel ao Shell.tsx do quibo-react */}
        <header className="drag-region flex items-center justify-between px-10 pt-[30px] pb-[14px] shrink-0">
          {/* Esquerda: seletor de mês ou título da página */}
          <div className="no-drag flex items-center gap-1">
            {showMonth ? (
              <>
                <button
                  onClick={irParaMesAnterior}
                  aria-label="Mês anterior"
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-ink-secondary hover:text-ink transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <span className="text-[22px] font-bold text-ink tracking-[-0.02em] min-w-[150px] text-center select-none">
                  {formatarMesAno(mes, ano)}
                </span>
                <button
                  onClick={irParaProximoMes}
                  aria-label="Próximo mês"
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-ink-secondary hover:text-ink transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </>
            ) : (
              <span className="text-[22px] font-bold text-ink tracking-[-0.02em] select-none">
                {title}
              </span>
            )}
          </div>

          {/* Direita: avatar MR + Adicionar */}
          <div className="no-drag flex items-center gap-4">
            <button
              onClick={() => navigate("/perfil")}
              aria-label="Perfil"
              className="w-10 h-10 rounded-full border border-border bg-surface text-ink-secondary font-bold text-sm flex items-center justify-center hover:bg-surface-subtle transition-colors"
            >
              MR
            </button>
            <button className="inline-flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-brand text-white font-semibold text-[15px] shadow-[0_6px_16px_-4px_rgba(64,120,230,.45)] hover:bg-brand-600 transition-colors">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="M12 5v14" />
              </svg>
              Adicionar
            </button>
          </div>
        </header>

        {/* Conteúdo da screen */}
        <main className="flex-1 overflow-y-auto px-10 pb-10 pt-[10px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
