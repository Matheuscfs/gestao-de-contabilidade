export function InvestimentosScreen() {
  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">patrimônio total</p>
          <p className="text-[22px] font-bold text-positive tabular-nums mt-1">R$ —</p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">rendimento mês</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">R$ —</p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">aplicações ativas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">—</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center" style={{ gridTemplateColumns: "minmax(0,1fr) 130px 130px 150px 44px" }}>
          <span className="text-xs font-semibold text-ink-muted">Investimento</span>
          <span className="text-xs font-semibold text-ink-muted">Tipo</span>
          <span className="text-xs font-semibold text-ink-muted">Rentabilidade</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Saldo</span>
          <span />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-sm text-ink-muted">
          Nenhum investimento cadastrado ainda.
        </div>
      </div>
    </div>
  );
}
