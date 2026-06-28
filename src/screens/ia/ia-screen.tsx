import { useState } from "react";

type View = "conselheiro" | "conversa" | "simulador";

const VIEWS: { id: View; label: string }[] = [
  { id: "conselheiro", label: "Conselheiro" },
  { id: "conversa", label: "Conversa" },
  { id: "simulador", label: "Simulador" },
];

export function IaScreen() {
  const [view, setView] = useState<View>("conselheiro");

  return (
    <div className="animate-fade-in">
      {/* Switcher de modo */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={[
              "h-8 px-4 rounded-lg text-sm font-semibold transition-all",
              view === id
                ? "bg-brand text-white shadow-xs"
                : "text-ink-secondary hover:text-ink",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "conselheiro" && <ConselheirView />}
      {view === "conversa" && <ConversaView />}
      {view === "simulador" && <SimuladorView />}
    </div>
  );
}

function ConselheirView() {
  return (
    <div className="space-y-3">
      <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
        <p className="text-sm font-semibold text-brand mb-1">Configure uma IA</p>
        <p className="text-sm text-ink-secondary">
          Conecte OpenAI, Claude ou Gemini nas integrações do perfil para receber insights personalizados.
        </p>
        <button className="mt-3 text-sm font-semibold text-brand hover:underline">
          Ir para integrações →
        </button>
      </div>

      {[
        { titulo: "Seus gastos com alimentação", desc: "Conecte uma IA para ver análises personalizadas dos seus padrões de consumo.", tag: "Padrão" },
        { titulo: "Simulação de reserva de emergência", desc: "Descubra em quantos meses você pode montar uma reserva com base na sua sobra mensal.", tag: "Simulação" },
        { titulo: "Oportunidade de economia", desc: "Identifique despesas que podem ser reduzidas sem impacto no seu bem-estar.", tag: "Economia" },
      ].map(({ titulo, desc, tag }) => (
        <div key={titulo} className="bg-surface border border-border rounded-xl p-5 opacity-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-ink">{titulo}</p>
              <p className="text-sm text-ink-secondary mt-1">{desc}</p>
            </div>
            <span className="shrink-0 inline-flex h-6 items-center px-2.5 rounded-full bg-surface-subtle border border-border text-xs font-semibold text-ink-secondary">
              {tag}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversaView() {
  return (
    <div className="flex flex-col gap-4" style={{ minHeight: 400 }}>
      <div className="flex-1 bg-surface border border-border rounded-xl flex items-center justify-center" style={{ minHeight: 320 }}>
        <p className="text-sm text-ink-muted">Configure uma IA para iniciar a conversa.</p>
      </div>
      <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
        <input
          placeholder="Pergunte algo sobre seu dinheiro…"
          disabled
          className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder disabled:cursor-not-allowed"
        />
        <button disabled className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center opacity-40">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SimuladorView() {
  return (
    <div className="space-y-3">
      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-ink mb-4">E se eu economizasse…</p>
        <div className="space-y-3">
          {["Alimentação fora de casa", "Assinaturas", "Lazer"].map((item) => (
            <div key={item} className="flex items-center justify-between">
              <span className="text-sm text-ink-secondary">{item}</span>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={100} defaultValue={0} className="w-28 accent-brand" />
                <span className="text-sm font-semibold text-ink tabular-nums w-10 text-right">0%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Impacto estimado</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-ink-muted">Nova sobra mensal</p>
            <p className="text-xl font-bold text-positive tabular-nums mt-0.5">R$ —</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Economia em 12 meses</p>
            <p className="text-xl font-bold text-positive tabular-nums mt-0.5">R$ —</p>
          </div>
        </div>
      </div>
    </div>
  );
}
