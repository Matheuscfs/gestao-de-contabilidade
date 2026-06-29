import { useState, useEffect, useCallback } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { formatarBRL } from "@/utils/money";
import {
  listarCartoes,
  criarCartao,
  atualizarCartao,
  deletarCartao,
} from "@/core/db/cartoes";
import type { CreditCard } from "@/core/db/schema";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Brand = "VISA" | "MASTERCARD" | "ELO" | "AMEX" | "HIPERCARD" | "DINERS" | "OTHER";

// ─── Constantes ───────────────────────────────────────────────────────────────

const BANDEIRAS: { id: Brand; label: string; cor: string; tint: string }[] = [
  { id: "VISA", label: "Visa", cor: "#1A1F71", tint: "#E8E9F5" },
  { id: "MASTERCARD", label: "Mastercard", cor: "#C0392B", tint: "#FDECEA" },
  { id: "ELO", label: "Elo", cor: "#C9A00C", tint: "#FEF9C3" },
  { id: "AMEX", label: "Amex", cor: "#006FCF", tint: "#E0F0FD" },
  { id: "HIPERCARD", label: "Hipercard", cor: "#882D1C", tint: "#FCE8E5" },
  { id: "DINERS", label: "Diners", cor: "#004A97", tint: "#E0EBF8" },
  { id: "OTHER", label: "Outros", cor: "#5B616E", tint: "#F0F2F6" },
];

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tintDaCor(cor: string): string {
  return CORES.find((c) => c.valor === cor)?.tint ?? "#F0F2F6";
}

function infoBandeira(brand: string) {
  return BANDEIRAS.find((b) => b.id === brand) ?? BANDEIRAS[BANDEIRAS.length - 1];
}

function labelDia(dia: number): string {
  return `dia ${dia}`;
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function AvatarCartao({ cor, brand }: { cor: string; brand: string }) {
  const bandeira = infoBandeira(brand);
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: tintDaCor(cor) }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={cor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
      {/* mini brand dot */}
      <span
        className="sr-only"
        aria-label={bandeira.label}
      />
    </div>
  );
}

function ChipBandeira({ brand }: { brand: string }) {
  const b = infoBandeira(brand);
  return (
    <span
      className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-semibold"
      style={{ background: b.tint, color: b.cor }}
    >
      {b.label}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 w-[42px] h-[25px] rounded-full border-none cursor-pointer transition-colors"
      style={{ background: checked ? "#4078E6" : "#D4D8E0", padding: 0 }}
    >
      <span
        className="absolute top-[3px] w-[19px] h-[19px] rounded-full bg-white transition-[left] duration-200"
        style={{
          left: checked ? "20px" : "3px",
          boxShadow: "0 1px 3px rgba(14,17,22,.25)",
        }}
      />
    </button>
  );
}

function InputDia({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex-1 block">
      <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">{label}</span>
      <span
        className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
        style={{ border: "1px solid #D4D8E0" }}
      >
        <input
          type="number"
          min={1}
          max={31}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1 && v <= 31) onChange(v);
          }}
          className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink font-sans"
        />
        <span className="text-[13px] text-ink-muted font-medium shrink-0">/ 31</span>
      </span>
    </label>
  );
}

// ─── Estado inicial do formulário ─────────────────────────────────────────────

function estadoVazio() {
  return {
    nome: "",
    brand: "VISA" as Brand,
    limiteCentavos: 0,
    diaFechamento: 1,
    diaVencimento: 10,
    cor: CORES[0].valor,
  };
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function CartoesCreditoScreen() {
  const [cartoes, setCartoes] = useState<CreditCard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [cartaoEditando, setCartaoEditando] = useState<CreditCard | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [brand, setBrand] = useState<Brand>("VISA");
  const [limiteCentavos, setLimiteCentavos] = useState(0);
  const [diaFechamento, setDiaFechamento] = useState(1);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [cor, setCor] = useState(CORES[0].valor);

  const { setOnAdicionar } = useHeaderActionsStore();

  // ── Carregamento ─────────────────────────────────────────────────────────────

  const carregarCartoes = useCallback(async () => {
    try {
      const lista = await listarCartoes();
      setCartoes(lista);
    } catch (e) {
      console.error("Erro ao carregar cartões:", e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarCartoes();
  }, [carregarCartoes]);

  // ── Ações do modal ────────────────────────────────────────────────────────────

  function abrirModalNovo() {
    const v = estadoVazio();
    setCartaoEditando(null);
    setNome(v.nome);
    setBrand(v.brand);
    setLimiteCentavos(v.limiteCentavos);
    setDiaFechamento(v.diaFechamento);
    setDiaVencimento(v.diaVencimento);
    setCor(v.cor);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }

  function abrirModalEdicao(cartao: CreditCard) {
    setCartaoEditando(cartao);
    setNome(cartao.name);
    setBrand(cartao.brand as Brand);
    setLimiteCentavos(cartao.limitCents);
    setDiaFechamento(cartao.closingDay);
    setDiaVencimento(cartao.dueDay);
    setCor(cartao.color);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setConfirmandoExclusao(false);
    setErroModal(null);
  }

  useEffect(() => {
    setOnAdicionar(abrirModalNovo);
    return () => setOnAdicionar(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async function salvar() {
    setErroModal(null);
    if (!nome.trim()) {
      setErroModal("Informe o nome do cartão.");
      return;
    }
    if (limiteCentavos <= 0) {
      setErroModal("Informe o limite do cartão.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        name: nome.trim(),
        brand,
        limitCents: limiteCentavos,
        closingDay: diaFechamento,
        dueDay: diaVencimento,
        color: cor,
        isActive: 1,
        source: "MANUAL",
      };
      if (cartaoEditando) {
        await atualizarCartao(cartaoEditando.id, dados);
      } else {
        await criarCartao(dados);
      }
      await carregarCartoes();
      fecharModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Erro ao salvar cartão:", e);
      setErroModal(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!cartaoEditando) return;
    setSalvando(true);
    try {
      await deletarCartao(cartaoEditando.id);
      await carregarCartoes();
      fecharModal();
    } catch (e) {
      console.error("Erro ao excluir cartão:", e);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(cartao: CreditCard) {
    try {
      await atualizarCartao(cartao.id, { isActive: cartao.isActive ? 0 : 1 });
      setCartoes((prev) =>
        prev.map((c) =>
          c.id === cartao.id ? { ...c, isActive: cartao.isActive ? 0 : 1 } : c
        )
      );
    } catch (e) {
      console.error("Erro ao alternar status do cartão:", e);
    }
  }

  // ── Derivados ─────────────────────────────────────────────────────────────────

  const cartoesFiltrados = cartoes.filter((c) =>
    c.name.toLowerCase().includes(busca.toLowerCase()) ||
    c.brand.toLowerCase().includes(busca.toLowerCase())
  );

  const cartoesAtivos = cartoes.filter((c) => c.isActive === 1);
  const limiteTotal = cartoesAtivos.reduce((soma, c) => soma + c.limitCents, 0);

  const podeSalvar = nome.trim().length > 0 && !salvando;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            cartões ativos
          </p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : cartoesAtivos.length}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            fatura deste mês
          </p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">R$ —</p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            limite total
          </p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : cartoesAtivos.length > 0 ? formatarBRL(limiteTotal) : "R$ —"}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 w-60 h-10 px-3.5 bg-surface border border-border rounded-xl">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-muted shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cartão…"
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div
          className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center"
          style={{
            gridTemplateColumns: "minmax(0,1fr) 130px 100px 100px 140px 56px 44px",
          }}
        >
          <span className="text-xs font-semibold text-ink-muted">Cartão</span>
          <span className="text-xs font-semibold text-ink-muted">Bandeira</span>
          <span className="text-xs font-semibold text-ink-muted">Fechamento</span>
          <span className="text-xs font-semibold text-ink-muted">Vencimento</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Limite</span>
          <span className="text-xs font-semibold text-ink-muted text-center">Ativo</span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : cartoesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-1">
            <p className="text-sm font-medium text-ink-muted">
              {busca ? "Nenhum resultado para esta busca." : "Nenhum cartão cadastrado ainda."}
            </p>
            {!busca && (
              <p className="text-xs text-ink-placeholder">
                Clique em "Adicionar" para cadastrar seu primeiro cartão.
              </p>
            )}
          </div>
        ) : (
          cartoesFiltrados.map((cartao, i) => (
            <div key={cartao.id}>
              <div
                className="grid px-5 py-3.5 items-center"
                style={{
                  gridTemplateColumns: "minmax(0,1fr) 130px 100px 100px 140px 56px 44px",
                }}
              >
                {/* Cartão */}
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarCartao cor={cartao.color} brand={cartao.brand} />
                  <p
                    className="text-[14px] font-semibold text-ink truncate"
                    style={{ opacity: cartao.isActive ? 1 : 0.45 }}
                  >
                    {cartao.name}
                  </p>
                </div>

                {/* Bandeira */}
                <div>
                  <ChipBandeira brand={cartao.brand} />
                </div>

                {/* Fechamento */}
                <p
                  className="text-[13px] font-medium text-ink-muted"
                  style={{ opacity: cartao.isActive ? 1 : 0.45 }}
                >
                  {labelDia(cartao.closingDay)}
                </p>

                {/* Vencimento */}
                <p
                  className="text-[13px] font-medium text-ink-muted"
                  style={{ opacity: cartao.isActive ? 1 : 0.45 }}
                >
                  {labelDia(cartao.dueDay)}
                </p>

                {/* Limite */}
                <p
                  className="text-[14px] font-semibold text-ink tabular-nums text-right"
                  style={{ opacity: cartao.isActive ? 1 : 0.45 }}
                >
                  {formatarBRL(cartao.limitCents)}
                </p>

                {/* Toggle ativo */}
                <div className="flex justify-center">
                  <Toggle
                    checked={cartao.isActive === 1}
                    onChange={() => alternarAtivo(cartao)}
                  />
                </div>

                {/* Editar */}
                <button
                  onClick={() => abrirModalEdicao(cartao)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer border-none bg-transparent"
                  aria-label="Editar cartão"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
              </div>

              {i < cartoesFiltrados.length - 1 && (
                <div className="h-px bg-border-subtle mx-5" />
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {modalAberto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[80]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={fecharModal}
        >
          <div
            className="w-[520px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
            style={{ padding: "30px 30px 26px", maxHeight: "calc(100vh - 48px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-[22px]">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                {cartaoEditando ? "Editar cartão" : "Novo cartão"}
              </p>
              <button
                onClick={fecharModal}
                aria-label="Fechar"
                className="w-[34px] h-[34px] rounded-full border-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "#F0F2F6", color: "#5B616E" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Nome */}
            <label className="block mb-5">
              <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                Nome do cartão
              </span>
              <span
                className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={{ border: "1px solid #D4D8E0" }}
              >
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Nubank Platinum"
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                />
              </span>
            </label>

            {/* Bandeira */}
            <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">Bandeira</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {BANDEIRAS.map((b) => {
                const ativo = brand === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBrand(b.id)}
                    className="h-9 px-4 rounded-full font-semibold text-[13px] cursor-pointer transition-colors"
                    style={{
                      border: ativo ? `1px solid ${b.cor}` : "1px solid #E3E6EC",
                      background: ativo ? b.tint : "#fff",
                      color: ativo ? b.cor : "#5B616E",
                    }}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>

            {/* Limite */}
            <label className="block mb-5">
              <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                Limite do cartão
              </span>
              <MoneyInput centavos={limiteCentavos} onChange={setLimiteCentavos} />
            </label>

            {/* Dias */}
            <div className="flex gap-3 mb-5">
              <InputDia
                label="Dia de fechamento"
                value={diaFechamento}
                onChange={setDiaFechamento}
              />
              <InputDia
                label="Dia de vencimento"
                value={diaVencimento}
                onChange={setDiaVencimento}
              />
            </div>

            {/* Cor */}
            <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">Cor</p>
            <div className="flex items-center justify-between mb-6">
              {CORES.map((c) => {
                const ativo = cor === c.valor;
                return (
                  <button
                    key={c.valor}
                    aria-label={c.label}
                    onClick={() => setCor(c.valor)}
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-110 border-none cursor-pointer"
                    style={{
                      background: c.valor,
                      outline: ativo ? `3px solid ${c.valor}` : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    {ativo && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Preview */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
              style={{ background: tintDaCor(cor), border: `1px solid ${cor}22` }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: cor + "22" }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={cor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: cor }}>
                  {nome || "Nome do cartão"}
                </p>
                <p className="text-[12px] font-medium mt-0.5" style={{ color: cor + "99" }}>
                  {infoBandeira(brand).label} · fecha dia {diaFechamento} · vence dia {diaVencimento}
                </p>
              </div>
              {limiteCentavos > 0 && (
                <p className="text-[14px] font-bold tabular-nums" style={{ color: cor }}>
                  {formatarBRL(limiteCentavos)}
                </p>
              )}
            </div>

            {/* Erro de validação / banco */}
            {erroModal && (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-[13px] font-medium"
                style={{ background: "#FEF2F2", color: "#D74A45", border: "1px solid #F5C5C3" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                {erroModal}
              </div>
            )}

            {/* Ações */}
            {confirmandoExclusao ? (
              <div>
                <p className="text-[13px] font-medium text-ink-muted mb-3 text-center">
                  Tem certeza? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setConfirmandoExclusao(false)}
                    className="flex-1 h-12 rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={excluir}
                    disabled={salvando}
                    className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: "#D74A45" }}
                  >
                    {salvando ? "Excluindo…" : "Excluir mesmo assim"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5">
                {cartaoEditando ? (
                  <button
                    onClick={() => setConfirmandoExclusao(true)}
                    className="shrink-0 h-12 px-4 rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ border: "1px solid #F5C5C3", background: "#FEF2F2", color: "#D74A45" }}
                  >
                    Excluir
                  </button>
                ) : (
                  <button
                    onClick={fecharModal}
                    className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={salvar}
                  disabled={!podeSalvar}
                  className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  style={{
                    background: "#4078E6",
                    boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
                  }}
                >
                  {salvando ? "Salvando…" : cartaoEditando ? "Salvar alterações" : "Adicionar cartão"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
