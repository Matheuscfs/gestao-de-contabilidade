import { useState } from "react";
import { useMesStore } from "@/app/mes-store";
import { formatarMesAno } from "@/utils/dates";

type Tab = "mes" | "ano" | "periodo" | "score" | "longo-prazo";

const TABS: { id: Tab; label: string }[] = [
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
  { id: "periodo", label: "Período" },
  { id: "score", label: "Score" },
  { id: "longo-prazo", label: "Longo prazo" },
];

export function AnaliseScreen() {
  const [tab, setTab] = useState<Tab>("mes");
  const { mes, ano } = useMesStore();

  return (
    <div className="animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              "h-8 px-4 rounded-lg text-sm font-semibold transition-all",
              tab === id
                ? "bg-brand text-white shadow-xs"
                : "text-ink-secondary hover:text-ink",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">sobra</p>
          <p className="text-[22px] font-bold text-positive tabular-nums mt-1">R$ —</p>
          <p className="text-xs text-ink-muted mt-1">vs. mês anterior</p>
        </div>
        <div className="bg-surface border border-border rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">receitas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">R$ —</p>
          <p className="text-xs text-ink-muted mt-1">{tab === "mes" ? formatarMesAno(mes, ano) : "—"}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">despesas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">R$ —</p>
          <p className="text-xs text-ink-muted mt-1">{tab === "mes" ? formatarMesAno(mes, ano) : "—"}</p>
        </div>
      </div>

      {/* Gráfico placeholder */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-4">
        <p className="text-sm font-semibold text-ink-secondary mb-4">Evolução do saldo</p>
        <div className="h-40 flex items-end gap-2 border-b border-border-subtle">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex-1 flex items-end">
              <div
                className="w-full rounded-t-sm bg-brand-50 border-t-2 border-brand opacity-60"
                style={{ height: `${30 + (i % 4) * 20}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((m) => (
            <span key={m} className="text-2xs text-ink-muted flex-1 text-center">{m}</span>
          ))}
        </div>
      </div>

      {/* Leitura da IA */}
      <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          <span className="text-sm font-semibold text-brand">Leitura da IA</span>
        </div>
        <p className="text-sm text-ink-secondary leading-relaxed">
          Configure uma IA nas integrações do perfil para receber análises personalizadas sobre seus gastos e receitas.
        </p>
      </div>
    </div>
  );
}
