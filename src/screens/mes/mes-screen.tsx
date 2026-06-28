export function MesScreen() {
  return (
    <div className="animate-fade-in">
      {/* Sobra */}
      <div className="text-center py-8 max-w-[680px] mx-auto">
        <p className="text-sm font-semibold text-ink-secondary">sobra esse mês</p>
        <p className="text-6xl font-bold tabular-nums text-positive mt-2 tracking-tight">
          R$ —
        </p>
        <p className="text-base font-semibold text-ink mt-3">
          Tá tranquilo. Dá pra respirar.
        </p>
      </div>

      <div className="max-w-[680px] mx-auto space-y-4">
        {/* Entrou / Saiu */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-positive" />
              <span className="text-sm font-semibold text-ink-secondary">Entrou</span>
            </div>
            <span className="text-base font-semibold text-ink tabular-nums">R$ —</span>
          </div>
          <div className="h-2 rounded-full bg-border-subtle overflow-hidden mb-5">
            <div className="h-full w-full bg-positive rounded-full" />
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-negative" />
              <span className="text-sm font-semibold text-ink-secondary">Saiu</span>
            </div>
            <span className="text-base font-semibold text-ink tabular-nums">R$ —</span>
          </div>
          <div className="h-2 rounded-full bg-border-subtle overflow-hidden">
            <div className="h-full w-0 bg-negative rounded-full" />
          </div>
        </div>

        {/* Falta confirmar */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xl font-semibold text-ink tracking-tight">Falta confirmar</h2>
            <span className="text-sm font-semibold text-ink-secondary">—</span>
          </div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <p className="px-5 py-4 text-sm text-ink-muted">Tudo em dia por aqui.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
