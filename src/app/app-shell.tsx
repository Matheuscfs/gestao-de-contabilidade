import { useHeaderActionsStore } from "@/app/header-actions-store";
import { prepararCompetencia, useMesStore } from "@/app/mes-store";
import { Sidebar } from "@/app/sidebar";
import { ROTAS_COM_MES, TITULOS_PAGINA } from "@/consts/navigation";
import { formatarMesAno } from "@/utils/dates";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

export function AppShell() {
  const { pathname } = useLocation();
  const { mes, ano, irParaMesAnterior, irParaProximoMes } = useMesStore();
  const { onAdicionar } = useHeaderActionsStore();

  const showMonth = ROTAS_COM_MES.has(pathname);
  const title = TITULOS_PAGINA[pathname] ?? "";

  // ── Ocorrências da competência ──────────────────────────────────────────────
  //
  // Na abertura do app o mês vem do relógio, sem passar pela troca de mês do
  // store — então é aqui que a primeira competência é materializada. As telas só
  // montam depois disso (`competenciaPronta`), garantindo que a primeira leitura
  // já enxergue as ocorrências geradas.
  //
  // Rodar também a cada navegação cobre o caso de o usuário acabar de cadastrar
  // uma receita/custo/dívida e vir para uma tela do mês: o modelo novo vira
  // ocorrência na hora. Quando isso acontece (e só quando), `versaoCompetencia`
  // muda e remonta a tela, para ela reler o banco já com o que foi gerado —
  // sem esse empurrão a tela ficaria mostrando a leitura anterior.
  const [competenciaPronta, setCompetenciaPronta] = useState(false);
  const [versaoCompetencia, setVersaoCompetencia] = useState(0);

  useEffect(() => {
    let ativo = true;
    // `prepararCompetencia` nunca rejeita — falha vira log e a navegação segue.
    prepararCompetencia(mes, ano).then((criadas) => {
      if (!ativo) return;
      setCompetenciaPronta(true);
      if (criadas > 0) setVersaoCompetencia((v) => v + 1);
    });
    return () => {
      ativo = false;
    };
  }, [mes, ano, pathname]);

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
          {competenciaPronta && <Outlet key={versaoCompetencia} />}
        </main>
      </div>
    </div>
  );
}
