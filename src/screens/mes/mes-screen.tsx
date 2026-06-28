import { useMesStore } from "@/app/mes-store";
import { formatarMesAno } from "@/utils/dates";

export function MesScreen() {
  const { mes, ano } = useMesStore();

  return (
    <div className="p-6 animate-fade-in">
      <header className="mb-6">
        <p className="text-sm text-ink-muted font-medium uppercase tracking-wide">
          {formatarMesAno(mes, ano)}
        </p>
        <h1 className="text-2xl font-semibold text-ink mt-0.5">
          Como está o mês
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        <div className="bg-surface rounded-xl border border-border p-6">
          <p className="text-sm text-ink-secondary">Sobra prevista</p>
          <p className="text-4xl font-semibold tabular-nums text-positive mt-1">
            R$ —
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-xl border border-border p-4">
            <p className="text-sm text-ink-secondary">Receita</p>
            <p className="text-2xl font-semibold tabular-nums text-ink mt-1">
              R$ —
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4">
            <p className="text-sm text-ink-secondary">Despesa</p>
            <p className="text-2xl font-semibold tabular-nums text-ink mt-1">
              R$ —
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="text-sm font-medium text-ink-secondary mb-3">
            Falta confirmar
          </p>
          <p className="text-sm text-ink-muted">Tudo em dia por aqui.</p>
        </div>
      </div>
    </div>
  );
}
