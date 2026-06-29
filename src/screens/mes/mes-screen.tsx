import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarContas, type Conta } from "@/core/db/contas";
import { listarPersonas, type PersonaComTotais } from "@/core/db/personas";
import {
  pluggyListarItems,
  pluggyStatusCredenciais,
  pluggySincronizarTodos,
  type ItemResumo,
} from "@/core/ipc/pluggy";
import { formatarBRL } from "@/utils/money";

// ─── Ícones ─────────────────────────────────────────────────────────────────

function IcoBanco({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" x2="21" y1="22" y2="22" />
      <line x1="6" x2="6" y1="18" y2="11" />
      <line x1="10" x2="10" y1="18" y2="11" />
      <line x1="14" x2="14" y1="18" y2="11" />
      <line x1="18" x2="18" y1="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}

function IcoCarteira({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function IcoPessoas({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IcoRefresh({ size = 16, spin }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={spin ? "animate-spin" : ""}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function IcoSeta({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function tempoRelativo(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 2) return "há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

/** Status agregado dos items conectados → cor + rótulo do indicador. */
function resumoStatus(items: ItemResumo[]): { cor: string; texto: string } {
  const temErro = items.some((i) => i.status === "LOGIN_ERROR" || i.status === "ERROR");
  const temAtencao = items.some((i) => i.status === "WAITING_USER_INPUT");
  const sincronizando = items.some((i) => i.status === "UPDATING" || i.status === "PENDING");
  if (temErro) return { cor: "bg-negative", texto: "Precisa de atenção" };
  if (temAtencao) return { cor: "bg-warning", texto: "Aguardando você" };
  if (sincronizando) return { cor: "bg-brand", texto: "Sincronizando…" };
  return { cor: "bg-positive", texto: "Tudo atualizado" };
}

// ─── Widget: Sincronização Pluggy ─────────────────────────────────────────────

function WidgetPluggy() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [configurado, setConfigurado] = useState(false);
  const [items, setItems] = useState<ItemResumo[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = async () => {
    try {
      const status = await pluggyStatusCredenciais();
      setConfigurado(status.configurado);
      if (status.configurado) {
        setItems(await pluggyListarItems());
      }
    } catch {
      setConfigurado(false);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      await pluggySincronizarTodos(false);
      setItems(await pluggyListarItems());
    } catch {
      /* erros ficam visíveis no status do item após recarregar */
      try {
        setItems(await pluggyListarItems());
      } catch {
        /* ignora */
      }
    } finally {
      setSincronizando(false);
    }
  };

  if (carregando) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="h-4 w-40 bg-border-subtle rounded animate-pulse" />
        <div className="h-3 w-28 bg-border-subtle rounded animate-pulse mt-3" />
      </div>
    );
  }

  // Não configurado, ou sem nenhum banco conectado → CTA de configuração.
  if (!configurado || items.length === 0) {
    return (
      <button
        onClick={() => navigate("/integracoes/pluggy")}
        className="group w-full text-left bg-surface border border-border rounded-xl p-5 hover:border-brand-200 hover:shadow-xs transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand flex items-center justify-center flex-none">
            <IcoBanco size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-ink">Conecte seu banco</p>
            <p className="text-sm text-ink-muted mt-0.5">
              {configurado
                ? "Credenciais salvas — falta vincular uma conta."
                : "Sincronize saldos e lançamentos automaticamente via Pluggy."}
            </p>
          </div>
          <span className="text-brand flex-none group-hover:translate-x-0.5 transition-transform">
            <IcoSeta />
          </span>
        </div>
      </button>
    );
  }

  const status = resumoStatus(items);
  const ultimaSync = items
    .map((i) => i.lastSyncedAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${status.cor}`} />
          <span className="text-sm font-semibold text-ink-secondary">{status.texto}</span>
        </div>
        <button
          onClick={sincronizar}
          disabled={sincronizando}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold text-brand hover:bg-brand-50 disabled:opacity-50 transition-colors"
        >
          <IcoRefresh spin={sincronizando} />
          {sincronizando ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => {
          const st = resumoStatus([item]);
          return (
            <div key={item.pluggyItemId} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-surface-subtle text-ink-secondary flex items-center justify-center flex-none">
                <IcoBanco size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">
                  {item.connectorName ?? "Banco conectado"}
                </p>
                <p className="text-xs text-ink-muted">
                  atualizado {tempoRelativo(item.lastSyncedAt)}
                </p>
              </div>
              <span className={`w-2 h-2 rounded-full flex-none ${st.cor}`} />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-muted mt-4">
        Última sincronização {tempoRelativo(ultimaSync)} · {items.length}{" "}
        {items.length === 1 ? "banco" : "bancos"}
      </p>
    </div>
  );
}

// ─── Widget: Saldo das contas ─────────────────────────────────────────────────

function WidgetSaldo() {
  const [carregando, setCarregando] = useState(true);
  const [contas, setContas] = useState<Conta[]>([]);

  useEffect(() => {
    listarContas()
      .then((lista) => setContas(lista.filter((c) => c.isActive)))
      .catch(() => setContas([]))
      .finally(() => setCarregando(false));
  }, []);

  const total = contas.reduce((acc, c) => acc + c.balanceCents, 0);
  const topo = [...contas].sort((a, b) => b.balanceCents - a.balanceCents).slice(0, 3);

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-ink-muted">
          <IcoCarteira />
        </span>
        <span className="text-sm font-semibold text-ink-secondary">Saldo das contas</span>
      </div>

      {carregando ? (
        <div className="h-8 w-32 bg-border-subtle rounded animate-pulse" />
      ) : contas.length === 0 ? (
        <p className="text-sm text-ink-muted py-2">Nenhuma conta cadastrada ainda.</p>
      ) : (
        <>
          <p className="text-3xl font-bold text-ink tabular-nums tracking-tight">
            {formatarBRL(total)}
          </p>
          <p className="text-xs text-ink-muted mt-1">
            em {contas.length} {contas.length === 1 ? "conta" : "contas"}
          </p>

          <div className="mt-4 space-y-2.5">
            {topo.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ background: c.color }}
                />
                <span className="text-sm text-ink-secondary truncate flex-1">{c.name}</span>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {formatarBRL(c.balanceCents)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Widget: Distribuição por persona ─────────────────────────────────────────

function WidgetPersonas() {
  const [carregando, setCarregando] = useState(true);
  const [personas, setPersonas] = useState<PersonaComTotais[]>([]);

  useEffect(() => {
    listarPersonas()
      .then(setPersonas)
      .catch(() => setPersonas([]))
      .finally(() => setCarregando(false));
  }, []);

  const comGasto = personas
    .filter((p) => p.despesasCents > 0)
    .sort((a, b) => b.despesasCents - a.despesasCents);
  const maior = comGasto[0]?.despesasCents ?? 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-ink-muted">
          <IcoPessoas />
        </span>
        <span className="text-sm font-semibold text-ink-secondary">Gastos por persona</span>
      </div>

      {carregando ? (
        <div className="space-y-3">
          <div className="h-3 w-full bg-border-subtle rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-border-subtle rounded animate-pulse" />
        </div>
      ) : comGasto.length === 0 ? (
        <p className="text-sm text-ink-muted py-2">Sem gastos atribuídos ainda.</p>
      ) : (
        <div className="space-y-3.5">
          {comGasto.slice(0, 4).map((p) => (
            <div key={p.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-none"
                    style={{ background: p.color }}
                  />
                  <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                </div>
                <span className="text-sm font-semibold text-ink tabular-nums flex-none">
                  {formatarBRL(p.despesasCents)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border-subtle overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${maior > 0 ? Math.max(6, (p.despesasCents / maior) * 100) : 0}%`,
                    background: p.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

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

        {/* Sincronização do banco (Pluggy) */}
        <WidgetPluggy />

        {/* Resumo do estado: saldo + distribuição por persona */}
        <div className="grid grid-cols-2 gap-4">
          <WidgetSaldo />
          <WidgetPersonas />
        </div>
      </div>
    </div>
  );
}
