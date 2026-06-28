import { useState, useEffect } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { formatarBRL } from "@/utils/money";

// ─── Tipos alinhados ao schema ────────────────────────────────────────────────

type TipoConta = "CHECKING" | "SAVINGS" | "INVESTMENT" | "CASH" | "OTHER";

type IconeId =
  | "bank"
  | "coins"
  | "wallet"
  | "briefcase"
  | "trending"
  | "card"
  | "building"
  | "star";

interface Conta {
  id: number;
  nome: string;
  tipo: TipoConta;
  cor: string;
  icone: IconeId;
  isPrimary: boolean;
  saldoCentavos: number;
}

// ─── Tipos de conta ───────────────────────────────────────────────────────────

const TIPOS: { id: TipoConta; label: string; icone: IconeId }[] = [
  { id: "CHECKING", label: "Corrente", icone: "bank" },
  { id: "SAVINGS", label: "Poupança", icone: "coins" },
  { id: "INVESTMENT", label: "Investimentos", icone: "trending" },
  { id: "CASH", label: "Dinheiro", icone: "wallet" },
  { id: "OTHER", label: "Outros", icone: "briefcase" },
];

function tipoLabel(tipo: TipoConta): string {
  return TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}

// ─── Paleta de cores (10 opções) ──────────────────────────────────────────────

const CORES: { valor: string; tint: string; label: string }[] = [
  { valor: "#4078E6", tint: "#EAF1FD", label: "Azul" },
  { valor: "#12A06B", tint: "#E2F4EC", label: "Verde" },
  { valor: "#D74A45", tint: "#FBE9E7", label: "Vermelho" },
  { valor: "#E8A020", tint: "#FCF1DF", label: "Âmbar" },
  { valor: "#EA580C", tint: "#FFF1E8", label: "Laranja" },
  { valor: "#9333EA", tint: "#F3E8FF", label: "Roxo" },
  { valor: "#E11D48", tint: "#FFE4E6", label: "Rosa" },
  { valor: "#0891B2", tint: "#E0F2FE", label: "Ciano" },
  { valor: "#0B6E4A", tint: "#DCFCE7", label: "Verde escuro" },
  { valor: "#1E4BA3", tint: "#DBEAFE", label: "Azul escuro" },
  { valor: "#5B616E", tint: "#F0F2F6", label: "Cinza" },
];

function tintDaCor(cor: string): string {
  return CORES.find((c) => c.valor === cor)?.tint ?? "#F0F2F6";
}

// ─── Ícones disponíveis ───────────────────────────────────────────────────────

function SvgIcone({ id, size = 20 }: { id: IconeId; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (id === "bank") {
    return (
      <svg {...props}>
        <line x1="3" x2="21" y1="22" y2="22" />
        <line x1="6" x2="6" y1="18" y2="11" />
        <line x1="10" x2="10" y1="18" y2="11" />
        <line x1="14" x2="14" y1="18" y2="11" />
        <line x1="18" x2="18" y1="18" y2="11" />
        <polygon points="12 2 20 7 4 7" />
      </svg>
    );
  }
  if (id === "coins") {
    return (
      <svg {...props}>
        <circle cx="8" cy="8" r="6" />
        <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
        <path d="M7 6h1v4" />
        <path d="m16.71 13.88.7.71-2.82 2.82" />
      </svg>
    );
  }
  if (id === "wallet") {
    return (
      <svg {...props}>
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
        <path d="M3 5a2 2 0 0 0 2 2h15a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4" />
      </svg>
    );
  }
  if (id === "briefcase") {
    return (
      <svg {...props}>
        <rect width="20" height="14" x="2" y="7" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    );
  }
  if (id === "trending") {
    return (
      <svg {...props}>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    );
  }
  if (id === "card") {
    return (
      <svg {...props}>
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    );
  }
  if (id === "building") {
    return (
      <svg {...props}>
        <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M12 6h.01" />
        <path d="M12 10h.01" />
        <path d="M12 14h.01" />
        <path d="M16 10h.01" />
        <path d="M16 14h.01" />
        <path d="M8 10h.01" />
        <path d="M8 14h.01" />
      </svg>
    );
  }
  // star (sparkle)
  return (
    <svg {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

const ICONES: IconeId[] = [
  "bank",
  "coins",
  "wallet",
  "briefcase",
  "trending",
  "card",
  "building",
  "star",
];

// ─── Componente de ícone na lista ─────────────────────────────────────────────

function BadgeConta({ cor, icone }: { cor: string; icone: IconeId }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: tintDaCor(cor), color: cor }}
    >
      <SvgIcone id={icone} size={20} />
    </div>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function ContasScreen() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [modalAberto, setModalAberto] = useState(false);

  // Campos do modal
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoConta>("CHECKING");
  const [cor, setCor] = useState(CORES[0].valor);
  const [icone, setIcone] = useState<IconeId>("bank");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saldoCentavos, setSaldoCentavos] = useState(0);

  const { setOnAdicionar } = useHeaderActionsStore();

  const totalCentavos = contas.reduce((soma, c) => soma + c.saldoCentavos, 0);
  const temPrimaria = contas.some((c) => c.isPrimary);

  function abrirModal() {
    setNome("");
    setTipo("CHECKING");
    setCor(CORES[0].valor);
    setIcone("bank");
    setIsPrimary(!temPrimaria); // sugere primária se não houver nenhuma ainda
    setSaldoCentavos(0);
    setModalAberto(true);
  }

  useEffect(() => {
    setOnAdicionar(abrirModal);
    return () => setOnAdicionar(null);
  }, [temPrimaria]);

  function fecharModal() {
    setModalAberto(false);
  }

  function salvar() {
    if (!nome.trim()) return;
    setContas((prev) => {
      const base = isPrimary
        ? prev.map((c) => ({ ...c, isPrimary: false }))
        : prev;
      return [
        ...base,
        { id: Date.now(), nome: nome.trim(), tipo, cor, icone, isPrimary, saldoCentavos },
      ];
    });
    fecharModal();
  }

  function handleChangeTipo(t: TipoConta) {
    setTipo(t);
    const novoPadrao = TIPOS.find((x) => x.id === t)?.icone ?? "bank";
    // só muda o ícone se ainda for o padrão do tipo anterior
    const padraoAnterior = TIPOS.find((x) => x.id === tipo)?.icone;
    if (icone === padraoAnterior) setIcone(novoPadrao);
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
                  <BadgeConta cor={conta.cor} icone={conta.icone} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-semibold text-ink">{conta.nome}</p>
                      {conta.isPrimary && (
                        <span className="inline-flex items-center h-[18px] px-2 rounded-full bg-brand-50 text-brand text-[11px] font-semibold">
                          principal
                        </span>
                      )}
                    </div>
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
            className="w-[500px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
            style={{ padding: "30px 30px 26px", maxHeight: "calc(100vh - 48px)" }}
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
                className="w-[34px] h-[34px] rounded-full border-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "#F0F2F6", color: "#5B616E" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Nome */}
            <label className="block mb-4">
              <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                Como você chama ela?
              </span>
              <span
                className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={{ border: "1px solid #D4D8E0" }}
              >
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Nubank"
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                />
              </span>
            </label>

            {/* Tipo */}
            <p className="text-[13px] font-semibold text-[#5B616E] mt-1.5 mb-2.5">
              Que tipo de conta?
            </p>
            <div className="flex gap-2 mb-5">
              {TIPOS.map((t) => {
                const ativo = tipo === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleChangeTipo(t.id)}
                    className="flex-1 h-9 rounded-full font-semibold text-[14px] cursor-pointer transition-colors"
                    style={{
                      border: ativo ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                      background: ativo ? "#EAF1FD" : "#fff",
                      color: ativo ? "#2F63C9" : "#5B616E",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Cor */}
            <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">
              Cor
            </p>
            <div className="flex items-center justify-between mb-5">
              {CORES.map((c) => {
                const ativo = cor === c.valor;
                return (
                  <button
                    key={c.valor}
                    aria-label={c.label}
                    onClick={() => setCor(c.valor)}
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-110"
                    style={{
                      background: c.valor,
                      outline: ativo ? `3px solid ${c.valor}` : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    {ativo && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Ícone */}
            <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">
              Ícone
            </p>
            <div className="flex items-center justify-between mb-5">
              {ICONES.map((id) => {
                const ativo = icone === id;
                return (
                  <button
                    key={id}
                    onClick={() => setIcone(id)}
                    className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                    style={{
                      background: ativo ? tintDaCor(cor) : "#F0F2F6",
                      color: ativo ? cor : "#5B616E",
                      border: ativo ? `1.5px solid ${cor}` : "1.5px solid transparent",
                    }}
                  >
                    <SvgIcone id={id} size={20} />
                  </button>
                );
              })}
            </div>

            {/* Conta principal */}
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
              style={{ background: "#F7F8FA", border: "1px solid #E3E6EC" }}
            >
              <div>
                <p className="text-[14px] font-semibold text-ink">Conta principal</p>
                <p className="text-[12px] font-medium text-[#5B616E] mt-0.5">
                  aparece em destaque no seu painel
                </p>
              </div>
              <button
                role="switch"
                aria-checked={isPrimary}
                onClick={() => setIsPrimary(!isPrimary)}
                className="relative shrink-0 w-[46px] h-[27px] rounded-full border-none cursor-pointer transition-colors"
                style={{ background: isPrimary ? "#4078E6" : "#D4D8E0", padding: 0 }}
              >
                <span
                  className="absolute top-[3px] w-[21px] h-[21px] rounded-full bg-white transition-[left] duration-200"
                  style={{
                    left: isPrimary ? "22px" : "3px",
                    boxShadow: "0 1px 3px rgba(14,17,22,.25)",
                  }}
                />
              </button>
            </div>

            {/* Saldo */}
            <label className="block mb-6">
              <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
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
                className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={!nome.trim()}
                className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{ background: "#4078E6", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
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
