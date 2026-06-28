import { NavLink } from "react-router-dom";
import { useMesStore } from "@/app/mes-store";
import { formatarMesAno } from "@/utils/dates";

const navItems = [
  { to: "/mes", label: "Mês" },
  { to: "/lancamentos", label: "Lançamentos" },
  { to: "/receitas", label: "Receitas" },
  { to: "/cartoes", label: "Cartões" },
  { to: "/dividas", label: "Dívidas" },
  { to: "/investimentos", label: "Investimentos" },
  { to: "/contas", label: "Contas" },
] as const;

export function Sidebar() {
  const { mes, ano, irParaMesAnterior, irParaProximoMes } = useMesStore();

  return (
    <aside className="w-sidebar shrink-0 flex flex-col h-full bg-surface border-r border-border">
      {/* Header — drag region */}
      <div className="drag-region px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 no-drag">
          <div className="w-6 h-6 rounded-md bg-brand" />
          <span className="font-semibold text-ink text-base tracking-tight">
            Quibo
          </span>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between rounded-lg bg-surface-subtle px-3 py-2">
          <button
            onClick={irParaMesAnterior}
            className="text-ink-secondary hover:text-ink transition-colors p-1 -ml-1 rounded"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-ink">
            {formatarMesAno(mes, ano)}
          </span>
          <button
            onClick={irParaProximoMes}
            className="text-ink-secondary hover:text-ink transition-colors p-1 -mr-1 rounded"
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-ink-secondary hover:bg-surface-subtle hover:text-ink",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Configurações */}
      <div className="px-3 pb-4">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            [
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-brand/10 text-brand"
                : "text-ink-secondary hover:bg-surface-subtle hover:text-ink",
            ].join(" ")
          }
        >
          Configurações
        </NavLink>
      </div>
    </aside>
  );
}
