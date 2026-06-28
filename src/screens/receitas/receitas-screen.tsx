export function ReceitasScreen() {
  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">fontes cadastradas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">—</p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">entram todo mês</p>
          <p className="text-[22px] font-bold text-positive tabular-nums mt-1">R$ —</p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">pontuais</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">R$ —</p>
        </div>
      </div>

      {/* Filtros + busca */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 w-60 h-10 px-3.5 bg-surface border border-border rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              placeholder="Buscar receita…"
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
            />
          </div>
          <button className="h-9 px-4 rounded-full border border-brand-200 bg-brand-50 text-brand text-sm font-semibold">Todas</button>
          <button className="h-9 px-4 rounded-full border border-border bg-surface text-ink-secondary text-sm font-semibold hover:bg-surface-subtle transition-colors">Recorrentes</button>
          <button className="h-9 px-4 rounded-full border border-border bg-surface text-ink-secondary text-sm font-semibold hover:bg-surface-subtle transition-colors">Pontuais</button>
        </div>
        <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-surface text-ink-secondary text-sm font-semibold hover:bg-surface-subtle transition-colors">
          Maior valor
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center" style={{ gridTemplateColumns: "minmax(0,1fr) 160px 150px 150px 44px" }}>
          <span className="text-xs font-semibold text-ink-muted">Fonte</span>
          <span className="text-xs font-semibold text-ink-muted">De quem</span>
          <span className="text-xs font-semibold text-ink-muted">Recorrência</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Valor</span>
          <span />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-sm text-ink-muted">
          Nenhuma receita cadastrada ainda.
        </div>
      </div>
    </div>
  );
}
