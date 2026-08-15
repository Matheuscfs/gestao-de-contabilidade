import { useState, useEffect, useCallback, useMemo } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { formatarBRL } from "@/utils/money";
import { mesAnoAtual, formatarMesAno } from "@/utils/dates";
import {
  listarCartoes,
  criarCartao,
  atualizarCartao,
  deletarCartao,
  faturaDoMes,
  faturaDoCartao,
  salvarFaturaCartao,
  excluirFaturaCartao,
  statusFaturasCartao,
  marcarFaturaPaga,
  type FaturaCartao,
  type EstadoFatura,
} from "@/core/db/cartoes";
import type { CreditCard } from "@/core/db/schema";
import cardVisa from "@/assets/cards/card-visa.svg";
import cardMastercard from "@/assets/cards/card-mastercard.svg";
import cardElo from "@/assets/cards/card-elo.svg";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Brand = "VISA" | "MASTERCARD" | "ELO" | "OTHER";

// ─── Constantes ───────────────────────────────────────────────────────────────

const BANDEIRAS: { id: Brand; label: string; cor: string; tint: string; logo: string | null }[] = [
  { id: "VISA", label: "Visa", cor: "#1A1F71", tint: "#E8E9F5", logo: cardVisa },
  { id: "MASTERCARD", label: "Mastercard", cor: "#C0392B", tint: "#FDECEA", logo: cardMastercard },
  { id: "ELO", label: "Elo", cor: "#C9A00C", tint: "#FEF9C3", logo: cardElo },
  { id: "OTHER", label: "Outros", cor: "#5B616E", tint: "#F0F2F6", logo: null },
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

/** Logo da bandeira em formato de cartão. Quando não há ícone (Outros), desenha
 * um cartão genérico na cor escolhida. */
function LogoBandeira({
  brand,
  cor,
  className,
}: {
  brand: string;
  cor?: string;
  className?: string;
}) {
  const b = infoBandeira(brand);
  if (b.logo) {
    return <img src={b.logo} alt={b.label} className={className} draggable={false} />;
  }
  const tint = cor ?? b.cor;
  return (
    <svg viewBox="0 0 70 47" fill="none" className={className} aria-label={b.label}>
      <rect x="0.5" y="0.5" width="69" height="46" rx="5.5" fill="#fff" stroke="#D9D9D9" />
      <rect x="10" y="15" width="50" height="6" rx="3" fill={tint} opacity="0.85" />
      <rect x="10" y="28" width="28" height="5" rx="2.5" fill={tint} opacity="0.35" />
    </svg>
  );
}

function AvatarCartao({ cor, brand }: { cor: string; brand: string }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
      style={{ background: tintDaCor(cor) }}
    >
      <LogoBandeira brand={brand} cor={cor} className="w-7 h-auto" />
    </div>
  );
}

function ChipBandeira({ brand }: { brand: string }) {
  const b = infoBandeira(brand);
  return (
    <span
      className="inline-flex items-center gap-1.5 h-[24px] pl-1 pr-2.5 rounded-full text-[11px] font-semibold"
      style={{ background: b.tint, color: b.cor }}
    >
      <span className="w-6 h-[18px] rounded-[3px] bg-white flex items-center justify-center overflow-hidden shrink-0">
        <LogoBandeira brand={brand} cor={b.cor} className="w-5 h-auto" />
      </span>
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

// ─── Modal de faturas ──────────────────────────────────────────────────────────

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function ModalFaturas({
  cartao,
  onClose,
  onChange,
}: {
  cartao: CreditCard;
  onClose: () => void;
  onChange: () => void;
}) {
  // Mês selecionado (começa no mês atual) — pode avançar/voltar sem limite.
  const [sel, setSel] = useState(() => mesAnoAtual());

  // Janela de 7 meses centrada no mês selecionado (selecionado ± 3).
  const meses = useMemo(() => {
    const lista: { mes: number; ano: number }[] = [];
    for (let d = -3; d <= 3; d++) {
      const data = new Date(sel.ano, sel.mes - 1 + d, 1);
      lista.push({ mes: data.getMonth() + 1, ano: data.getFullYear() });
    }
    return lista;
  }, [sel.mes, sel.ano]);

  function mover(delta: number) {
    const data = new Date(sel.ano, sel.mes - 1 + delta, 1);
    setSel({ mes: data.getMonth() + 1, ano: data.getFullYear() });
  }

  const [fatura, setFatura] = useState<FaturaCartao | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, EstadoFatura>>({});
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [f, mapa] = await Promise.all([
        faturaDoCartao(cartao.id, sel.mes, sel.ano),
        statusFaturasCartao(cartao.id),
      ]);
      setFatura(f);
      setStatusMap(mapa);
      setValor(f?.amountCents ?? 0);
      setEditando(false);
      setConfirmandoExclusao(false);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar fatura",
        mensagemUsuario: "Não foi possível carregar a fatura.",
      });
    } finally {
      setCarregando(false);
    }
  }, [cartao.id, sel.mes, sel.ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    if (valor <= 0) return;
    setSalvando(true);
    try {
      await salvarFaturaCartao(cartao.id, sel.mes, sel.ano, valor);
      await carregar();
      onChange();
      toast.sucesso(fatura ? "Fatura atualizada" : "Fatura adicionada");
    } catch (e) {
      tratarErro(e, {
        contexto: "salvar fatura",
        mensagemUsuario: "Não foi possível salvar a fatura.",
      });
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setSalvando(true);
    try {
      await excluirFaturaCartao(cartao.id, sel.mes, sel.ano);
      await carregar();
      onChange();
      toast.sucesso("Fatura excluída");
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir fatura",
        mensagemUsuario: "Não foi possível excluir a fatura.",
      });
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPaga() {
    if (!fatura) return;
    setSalvando(true);
    try {
      await marcarFaturaPaga(cartao.id, sel.mes, sel.ano, !fatura.paga);
      await carregar();
      onChange();
      toast.sucesso(fatura.paga ? "Fatura reaberta" : "Fatura paga");
    } catch (e) {
      tratarErro(e, {
        contexto: "atualizar pagamento da fatura",
        mensagemUsuario: "Não foi possível atualizar o pagamento.",
      });
    } finally {
      setSalvando(false);
    }
  }

  // Cores do chip por estado da fatura: paga (verde), aberta (laranja), vazia (branco).
  function coresMes(m: { mes: number; ano: number }, ativo: boolean) {
    const estado = statusMap[`${m.ano}-${m.mes}`];
    let bg = "#fff";
    let borda = "#E3E6EC";
    let fg = "#5B616E";
    let acento = cartao.color;
    if (estado?.paga) {
      bg = "#E2F4EC";
      borda = "#9BD9BE";
      fg = "#0B6E4A";
      acento = "#12A06B";
    } else if (estado) {
      bg = "#FEF3E2";
      borda = "#F2C879";
      fg = "#B4690E";
      acento = "#E8A020";
    }
    return {
      background: bg,
      border: ativo ? `1.5px solid ${acento}` : `1px solid ${borda}`,
      color: ativo ? acento : fg,
      boxShadow: ativo ? `0 4px 12px -6px ${acento}88` : "none",
    };
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[90]"
      style={{ background: "rgba(14,17,22,.42)" }}
      onClick={onClose}
    >
      <div
        className="w-[640px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
        style={{ padding: "30px 30px 26px", maxHeight: "calc(100vh - 48px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{ background: tintDaCor(cartao.color) }}
            >
              <LogoBandeira brand={cartao.brand} cor={cartao.color} className="w-8 h-auto" />
            </div>
            <div className="min-w-0">
              <p className="text-[20px] font-bold text-ink tracking-tight truncate">
                Faturas
              </p>
              <p className="text-[13px] font-medium text-ink-muted truncate">{cartao.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-[34px] h-[34px] rounded-full border-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
            style={{ background: "#F0F2F6", color: "#5B616E" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Switch de meses */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => mover(-1)}
            aria-label="Mês anterior"
            className="w-9 h-9 shrink-0 rounded-lg border border-border bg-surface flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="flex-1 grid grid-cols-7 gap-1.5">
            {meses.map((m) => {
              const ativo = m.mes === sel.mes && m.ano === sel.ano;
              return (
                <button
                  key={`${m.ano}-${m.mes}`}
                  onClick={() => setSel(m)}
                  className="flex flex-col items-center justify-center h-12 rounded-xl cursor-pointer transition-colors"
                  style={coresMes(m, ativo)}
                >
                  <span className="text-[12px] font-bold uppercase leading-none">
                    {MESES_ABREV[m.mes - 1]}
                  </span>
                  <span className="text-[10px] font-medium opacity-70 mt-0.5 leading-none">
                    {m.ano}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => mover(1)}
            aria-label="Próximo mês"
            className="w-9 h-9 shrink-0 rounded-lg border border-border bg-surface flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Fatura do mês selecionado */}
        <div className="rounded-2xl border border-border p-5 min-h-[180px] flex flex-col">
          <p className="text-[13px] font-semibold text-ink-muted capitalize mb-3">
            {formatarMesAno(sel.mes, sel.ano)}
          </p>

          {carregando ? (
            <div className="flex-1 flex items-center justify-center text-sm text-ink-muted">
              Carregando…
            </div>
          ) : editando ? (
            <div className="flex-1 flex flex-col">
              <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                Valor da fatura
              </span>
              <MoneyInput centavos={valor} onChange={setValor} />
              <div className="flex gap-2.5 mt-auto pt-5">
                <button
                  onClick={() => {
                    setEditando(false);
                    setValor(fatura?.amountCents ?? 0);
                  }}
                  className="flex-1 h-12 rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={valor <= 0 || salvando}
                  className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  style={{ background: "#4078E6", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
                >
                  {salvando ? "Salvando…" : "Salvar fatura"}
                </button>
              </div>
            </div>
          ) : fatura ? (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2.5">
                <p className="text-[32px] font-bold text-ink tabular-nums leading-none">
                  {formatarBRL(fatura.amountCents)}
                </p>
                <span
                  className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-semibold"
                  style={
                    fatura.paga
                      ? { background: "#E2F4EC", color: "#0B6E4A" }
                      : { background: "#FEF3E2", color: "#B4690E" }
                  }
                >
                  {fatura.paga ? "Paga" : "Em aberto"}
                </span>
              </div>
              {confirmandoExclusao ? (
                <div className="mt-auto pt-5">
                  <p className="text-[13px] font-medium text-ink-muted mb-3">
                    Remover a fatura deste mês?
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
                      className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 transition-opacity"
                      style={{ background: "#D74A45" }}
                    >
                      {salvando ? "Excluindo…" : "Excluir"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5 mt-auto pt-5">
                  <button
                    onClick={alternarPaga}
                    disabled={salvando}
                    className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 transition-opacity"
                    style={
                      fatura.paga
                        ? { background: "#5B616E" }
                        : { background: "#12A06B", boxShadow: "0 6px 16px -4px rgba(18,160,107,.45)" }
                    }
                  >
                    {salvando
                      ? "Salvando…"
                      : fatura.paga
                        ? "Reabrir fatura"
                        : "Marcar como paga"}
                  </button>
                  <button
                    onClick={() => setEditando(true)}
                    className="shrink-0 h-12 px-5 rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmandoExclusao(true)}
                    className="shrink-0 h-12 px-5 rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ border: "1px solid #F5C5C3", background: "#FEF2F2", color: "#D74A45" }}
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-2">
              <p className="text-sm font-medium text-ink-muted">
                Nenhuma fatura registrada neste mês.
              </p>
              <button
                onClick={() => {
                  setValor(0);
                  setEditando(true);
                }}
                className="h-11 px-6 rounded-full border-none text-white font-semibold text-[14px] cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: "#4078E6", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
              >
                Adicionar fatura
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
    ativo: true,
  };
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function CartoesCreditoScreen() {
  const [cartoes, setCartoes] = useState<CreditCard[]>([]);
  const [faturaMesCents, setFaturaMesCents] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [cartaoEditando, setCartaoEditando] = useState<CreditCard | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  // Modal de faturas
  const [cartaoFaturas, setCartaoFaturas] = useState<CreditCard | null>(null);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [brand, setBrand] = useState<Brand>("VISA");
  const [limiteCentavos, setLimiteCentavos] = useState(0);
  const [diaFechamento, setDiaFechamento] = useState(1);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [cor, setCor] = useState(CORES[0].valor);
  const [ativo, setAtivo] = useState(true);

  const { setOnAdicionar } = useHeaderActionsStore();

  // ── Carregamento ─────────────────────────────────────────────────────────────

  const carregarCartoes = useCallback(async () => {
    try {
      const agora = new Date();
      const [lista, fatura] = await Promise.all([
        listarCartoes(),
        faturaDoMes(agora.getMonth() + 1, agora.getFullYear()),
      ]);
      setCartoes(lista);
      setFaturaMesCents(fatura);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar cartões",
        mensagemUsuario: "Não foi possível carregar os cartões.",
      });
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
    setAtivo(v.ativo);
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
    setAtivo(cartao.isActive === 1);
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
        isActive: ativo ? 1 : 0,
      };
      if (cartaoEditando) {
        // Não mexe no `source`: marcar um cartão importado como MANUAL não tira
        // o `pluggy_id`, então o próximo sync casaria por ele e sobrescreveria a
        // edição — o campo fica oscilando entre PLUGGY e MANUAL.
        await atualizarCartao(cartaoEditando.id, dados);
      } else {
        await criarCartao({ ...dados, source: "MANUAL" });
      }
      await carregarCartoes();
      fecharModal();
      toast.sucesso(cartaoEditando ? "Cartão atualizado" : "Cartão adicionado");
    } catch (e) {
      setErroModal(
        tratarErro(e, {
          contexto: "salvar cartão",
          mensagemUsuario: "Não foi possível salvar o cartão.",
        })
      );
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
      toast.sucesso("Cartão excluído");
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir cartão",
        mensagemUsuario: "Não foi possível excluir o cartão.",
      });
    } finally {
      setSalvando(false);
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
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando || faturaMesCents <= 0 ? "R$ —" : formatarBRL(faturaMesCents)}
          </p>
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
            gridTemplateColumns: "minmax(0,1fr) 150px 96px 96px 130px 210px",
          }}
        >
          <span className="text-xs font-semibold text-ink-muted">Cartão</span>
          <span className="text-xs font-semibold text-ink-muted">Bandeira</span>
          <span className="text-xs font-semibold text-ink-muted">Fechamento</span>
          <span className="text-xs font-semibold text-ink-muted">Vencimento</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Limite</span>
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
                  gridTemplateColumns: "minmax(0,1fr) 150px 96px 96px 130px 210px",
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
                  {!cartao.isActive && (
                    <span className="shrink-0 inline-flex items-center h-[20px] px-2 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-surface-subtle text-ink-muted">
                      Inativo
                    </span>
                  )}
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

                {/* Ações */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => abrirModalEdicao(cartao)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-surface text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                    Editar
                  </button>
                  <button
                    onClick={() => setCartaoFaturas(cartao)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-surface text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                      <path d="M14 2v5h5" />
                      <path d="M8 13h8" />
                      <path d="M8 17h8" />
                      <path d="M8 9h2" />
                    </svg>
                    Faturas
                  </button>
                </div>
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

            {/* Aviso: cartão importado é regravado pelo sync */}
            {cartaoEditando?.source === "PLUGGY" && (
              <div
                className="flex items-start gap-2 rounded-xl px-4 py-3 mb-5 text-[12.5px] font-medium"
                style={{ background: "#FCF1DF", color: "#B4690E", border: "1px solid #F2C879" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <span>
                  Este cartão vem do banco. Nome, limite e dias podem ser
                  substituídos pelos dados oficiais no próximo sync.
                </span>
              </div>
            )}

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
            <div className="grid grid-cols-4 gap-2 mb-5">
              {BANDEIRAS.map((b) => {
                const ativo = brand === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBrand(b.id)}
                    aria-pressed={ativo}
                    className="flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-xl cursor-pointer transition-all"
                    style={{
                      border: ativo ? `1.5px solid ${b.cor}` : "1px solid #E3E6EC",
                      background: ativo ? b.tint : "#fff",
                      boxShadow: ativo ? `0 4px 12px -6px ${b.cor}66` : "none",
                    }}
                  >
                    <LogoBandeira brand={b.id} cor={b.cor} className="w-9 h-auto" />
                    <span
                      className="text-[11px] font-semibold leading-none"
                      style={{ color: ativo ? b.cor : "#5B616E" }}
                    >
                      {b.label}
                    </span>
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

            {/* Ativo (somente na edição) */}
            {cartaoEditando && (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
                style={{ border: "1px solid #E3E6EC" }}
              >
                <div>
                  <p className="text-[14px] font-semibold text-ink">Cartão ativo</p>
                  <p className="text-[12px] text-ink-muted mt-0.5">
                    Cartões inativos não entram nas faturas nem no limite total.
                  </p>
                </div>
                <Toggle checked={ativo} onChange={setAtivo} />
              </div>
            )}

            {/* Preview */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
              style={{ background: tintDaCor(cor), border: `1px solid ${cor}22` }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                style={{ background: cor + "22" }}
              >
                <LogoBandeira brand={brand} cor={cor} className="w-7 h-auto" />
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

      {/* ── Modal de faturas ──────────────────────────────────────────────────── */}
      {cartaoFaturas && (
        <ModalFaturas
          cartao={cartaoFaturas}
          onClose={() => setCartaoFaturas(null)}
          onChange={carregarCartoes}
        />
      )}
    </div>
  );
}
