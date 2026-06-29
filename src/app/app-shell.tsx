import { useHeaderActionsStore } from "@/app/header-actions-store";
import { useMesStore } from "@/app/mes-store";
import { Sidebar } from "@/app/sidebar";
import { ROTAS_COM_MES, TITULOS_PAGINA } from "@/consts/navigation";
import { formatarMesAno } from "@/utils/dates";
import { Outlet, useLocation } from "react-router-dom";

export function AppShell() {
  const { pathname } = useLocation();
  const { mes, ano, irParaMesAnterior, irParaProximoMes } = useMesStore();
  const { onAdicionar } = useHeaderActionsStore();

  const showMonth = ROTAS_COM_MES.has(pathname);
  const title = TITULOS_PAGINA[pathname] ?? "";

  return (
    <div className="h-full bg-surface-subtle overflow-hidden flex gap-3 p-4">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header — fiel ao Shell.tsx do quibo-react */}
        <header className="drag-region flex items-center justify-between px-10 pt-[10px] pb-[14px] shrink-0">
          {/* Esquerda: seletor de mês ou título da página */}
          <div className="no-drag flex items-center gap-1">
            {showMonth ? (
              <>
                <button
                  onClick={irParaMesAnterior}
                  aria-label="Mês anterior"
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-ink-secondary hover:text-ink transition-colors"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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

          {/* Direita: Adicionar (só quando a tela registra uma ação) */}
          <div className="no-drag flex items-center gap-4">
            {onAdicionar && (
              <button
                onClick={() => onAdicionar()}
                className="inline-flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-brand text-white font-semibold text-[15px] shadow-[0_6px_16px_-4px_rgba(64,120,230,.45)] hover:bg-brand-600 transition-colors"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Adicionar
              </button>
            )}
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
