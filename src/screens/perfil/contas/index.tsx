import { useState, useEffect } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { formatarBRL } from "@/utils/money";

type TipoConta = "corrente" | "poupanca" | "carteira" | "pj";

interface Conta {
  id: number;
  nome: string;
  tipo: TipoConta;
  saldoCentavos: number;
}

const TIPOS: { id: TipoConta; label: string }[] = [
  { id: "corrente", label: "Conta corrente" },
  { id: "poupanca", label: "Poupança" },
  { id: "carteira", label: "Carteira" },
  { id: "pj", label: "PJ" },
];

function tipoLabel(tipo: TipoConta): string {
  return TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}

function IconeConta({ tipo }: { tipo: TipoConta }) {
  if (tipo === "corrente") {
    return (
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#EAF1FD", color: "#2F63C9" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" x2="21" y1="22" y2="22" />
          <line x1="6" x2="6" y1="18" y2="11" />
          <line x1="10" x2="10" y1="18" y2="11" />
          <line x1="14" x2="14" y1="18" y2="11" />
          <line x1="18" x2="18" y1="18" y2="11" />
          <polygon points="12 2 20 7 4 7" />
        </svg>
      </div>
    );
  }

  if (tipo === "poupanca") {
    return (
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#E2F4EC", color: "#12A06B" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="m16.71 13.88.7.71-2.82 2.82" />
        </svg>
      </div>
    );
  }

  if (tipo === "carteira") {
    return (
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#F0F2F6", color: "#5B616E" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
          <path d="M3 5a2 2 0 0 0 2 2h15a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#F0F2F6", color: "#5B616E" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="7" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    </div>
  );
}

export function ContasScreen() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoConta>("corrente");
  const [saldoCentavos, setSaldoCentavos] = useState(0);

  const { setOnAdicionar } = useHeaderActionsStore();

  const totalCentavos = contas.reduce((soma, c) => soma + c.saldoCentavos, 0);

  function abrirModal() {
    setNome("");
    setTipo("corrente");
    setSaldoCentavos(0);
    setModalAberto(true);
  }

  useEffect(() => {
    setOnAdicionar(abrirModal);
    return () => setOnAdicionar(null);
  }, []);

  function fecharModal() {
    setModalAberto(false);
  }

  function salvar() {
    if (!nome.trim()) return;
    setContas((prev) => [
      ...prev,
      { id: Date.now(), nome: nome.trim(), tipo, saldoCentavos },
    ]);
    fecharModal();
  }

  return (
    <div className="animate-fade-in">
      <div className="max-w-[680px] mx-auto w-full pt-[18px]">
        {/* Total */}
        <div className="text-center pt-6 pb-1.5">
          <p className="text-[14px] font-semibold text-[#5B616E]">
            onde seu dinheiro está
          </p>
          <p className="text-[46px] font-bold text-ink tracking-[-0.02em] tabular-nums mt-1.5 leading-[1.05]">
            {contas.length > 0 ? formatarBRL(totalCentavos) : "R$ —"}
          </p>
        </div>

        {/* Cabeçalho da lista */}
        <div className="flex items-center justify-between mx-1 mt-[26px] mb-3">
          <p className="text-[20px] font-semibold text-ink tracking-tight">
            Suas contas
          </p>
          {contas.length > 0 && (
            <p className="text-[13px] font-semibold text-[#5B616E]">
              {contas.length} {contas.length === 1 ? "conta" : "contas"}
            </p>
          )}
        </div>

        {/* Lista */}
        <div className="bg-surface border border-[#E3E6EC] rounded-xl overflow-hidden">
          {contas.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
              Nenhuma conta cadastrada ainda.
            </div>
          ) : (
            contas.map((conta, i) => (
              <div key={conta.id}>
                <div className="flex items-center gap-[14px] px-5 py-[18px]">
                  <IconeConta tipo={conta.tipo} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-ink">{conta.nome}</p>
                    <p className="text-[13px] font-medium text-[#5B616E] mt-0.5">
                      {tipoLabel(conta.tipo)}
                    </p>
                  </div>
                  <p className="text-[17px] font-semibold text-ink tabular-nums">
                    {formatarBRL(conta.saldoCentavos)}
                  </p>
                </div>
                {i < contas.length - 1 && (
                  <div className="h-px bg-[#E3E6EC] mx-5" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {modalAberto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[80]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={fecharModal}
        >
          <div
            className="w-[460px] bg-surface rounded-3xl p-[30px] pb-[26px] shadow-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-[22px]">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                Nova conta
              </p>
              <button
                onClick={fecharModal}
                aria-label="Fechar"
                className="w-[34px] h-[34px] rounded-full bg-surface-subtle text-ink-secondary flex items-center justify-center hover:bg-border transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Nome */}
            <label className="block mb-4">
              <span className="block text-[13px] font-semibold text-ink-muted mb-2">
                Como você chama ela?
              </span>
              <div className="flex items-center h-[52px] px-4 bg-surface rounded-xl border border-border-strong focus-within:border-brand transition-colors">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Nubank"
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder"
                />
              </div>
            </label>

            {/* Tipo */}
            <p className="text-[13px] font-semibold text-ink-muted mt-1.5 mb-2.5">
              Que tipo de conta?
            </p>
            <div className="flex flex-wrap gap-2 mb-[18px]">
              {TIPOS.map((t) => {
                const ativo = tipo === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTipo(t.id)}
                    className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors ${
                      ativo
                        ? "border border-brand-200 bg-brand-50 text-brand"
                        : "border border-border bg-surface text-ink-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Saldo */}
            <label className="block mb-6">
              <span className="block text-[13px] font-semibold text-ink-muted mb-2">
                Quanto tem agora?
              </span>
              <MoneyInput
                centavos={saldoCentavos}
                onChange={setSaldoCentavos}
              />
            </label>

            {/* Ações */}
            <div className="flex gap-2.5">
              <button
                onClick={fecharModal}
                className="shrink-0 h-12 px-[22px] rounded-full border border-border-strong bg-surface text-ink text-[15px] font-semibold hover:bg-surface-subtle transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={!nome.trim()}
                className="flex-1 h-12 rounded-full bg-brand text-white text-[15px] font-semibold shadow-[0_6px_16px_-4px_rgba(64,120,230,.45)] hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
