import { useState, useEffect, useCallback, useRef } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { SeletorCategoria } from "@/components/seletor-categoria";
import { SeletorConta } from "@/components/seletor-conta";
import { ContaAvatar } from "@/components/conta-avatar";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { formatarBRL } from "@/utils/money";
import { hoje, diasUteisNoMes, mesAnoAtual, formatarMesAno } from "@/utils/dates";
import {
  listarReceitas,
  criarReceita,
  editarReceita,
  excluirReceita,
  listarCategoriasReceita,
  calcularValorMensal,
  type Receita,
  type TipoReceita,
} from "@/core/db/receitas";
import { listarContas, type Conta } from "@/core/db/contas";
import type { Category } from "@/core/db/schema";
import {
  calcularCLT,
  MODALIDADE_LABEL,
  CLT_ANO_REFERENCIA,
  type Modalidade,
} from "@/consts/clt";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Filtro = "todas" | "fixas" | "hora";
type Ordenacao = "MAIOR" | "MENOR" | "AZ" | "ZA";

const ORDENACAO_LABEL: Record<Ordenacao, string> = {
  MAIOR: "Maior valor",
  MENOR: "Menor valor",
  AZ: "A–Z",
  ZA: "Z–A",
};

const HORAS_PADRAO = 8;

const MODALIDADE_OPCOES: { value: Modalidade; label: string }[] = [
  { value: "PJ", label: MODALIDADE_LABEL.PJ },
  { value: "CLT", label: MODALIDADE_LABEL.CLT },
  { value: "OUTRO", label: MODALIDADE_LABEL.OUTRO },
];

// Mês corrente e seus dias úteis (dias de semana − feriados nacionais).
// As receitas por hora valem por mês conforme essa contagem.
const { mes: MES_ATUAL, ano: ANO_ATUAL } = mesAnoAtual();
const DIAS_UTEIS_MES = diasUteisNoMes(MES_ATUAL, ANO_ATUAL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Valor mensal de referência (mês corrente) de uma receita. */
function valorMes(r: Receita): number {
  return calcularValorMensal(r, DIAS_UTEIS_MES);
}

function computarStats(lista: Receita[]) {
  const fixas = lista.filter((r) => r.tipo === "FIXO");
  const hora = lista.filter((r) => r.tipo === "HORA");
  return {
    cadastradas: lista.length,
    totalMensal: lista.reduce((s, r) => s + valorMes(r), 0),
    totalFixo: fixas.reduce((s, r) => s + valorMes(r), 0),
    totalHora: hora.reduce((s, r) => s + valorMes(r), 0),
    countFixo: fixas.length,
    countHora: hora.length,
  };
}

/** "2026-06-29" → "29/06/26" */
function dataCurta(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

function descreverPeriodo(start: string | null, end: string | null): string | null {
  if (start && end) return `${dataCurta(start)} – ${dataCurta(end)}`;
  if (start) return `desde ${dataCurta(start)}`;
  if (end) return `até ${dataCurta(end)}`;
  return null;
}

function detalheHora(r: Receita): string {
  const rate = r.hourlyRateCents != null ? formatarBRL(r.hourlyRateCents) : "—";
  const horas = r.hoursPerDay ?? 0;
  return `${rate}/h · ${horas}h/dia · ${DIAS_UTEIS_MES} dias úteis`;
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IconBusca() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconFechar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

// ─── Select simples reutilizável ──────────────────────────────────────────────

function CampoSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">{label}</span>
      <span className="relative flex items-center h-[52px] pl-4 pr-3 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink font-sans cursor-pointer appearance-none pr-5"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 text-ink-muted">
          <IconChevron />
        </span>
      </span>
    </label>
  );
}

// ─── Campo numérico reutilizável (dia, horas, dias úteis) ─────────────────────

function CampoNumero({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  placeholder,
  sufixo,
}: {
  label: string;
  hint?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  min: number;
  max: number;
  placeholder?: string;
  sufixo?: string;
}) {
  return (
    <label className="flex-1 block min-w-0">
      <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
        {label} {hint && <span className="font-normal text-ink-muted">{hint}</span>}
      </span>
      <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") return onChange("");
            const n = parseInt(val, 10);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
        />
        {sufixo && <span className="text-[13px] text-ink-muted font-medium shrink-0">{sufixo}</span>}
      </span>
    </label>
  );
}

function CampoData({
  label,
  hint,
  value,
  onChange,
  disabled,
  min,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  min?: string;
}) {
  return (
    <label className="flex-1 block min-w-0">
      <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
        {label} {hint && <span className="font-normal text-ink-muted">{hint}</span>}
      </span>
      <span
        className="flex items-center h-[52px] px-4 rounded-xl focus-within:border-brand transition-colors"
        style={{ border: "1px solid #D4D8E0", background: disabled ? "#F5F6F8" : "#fff", opacity: disabled ? 0.6 : 1 }}
      >
        <input
          type="date"
          value={value}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans disabled:cursor-not-allowed"
        />
      </span>
    </label>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function ReceitasScreen() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [categoriasDB, setCategoriasDB] = useState<Category[]>([]);
  const [contasDB, setContasDB] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("MAIOR");
  const [menuOrdemAberto, setMenuOrdemAberto] = useState(false);
  const menuOrdemRef = useRef<HTMLDivElement>(null);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Receita | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [modalidade, setModalidade] = useState<Modalidade>("PJ");
  const [tipo, setTipo] = useState<TipoReceita>("FIXO");
  const [amountCents, setAmountCents] = useState(0);
  const [hourlyRateCents, setHourlyRateCents] = useState(0);
  const [hoursPerDay, setHoursPerDay] = useState<number | "">(HORAS_PADRAO);
  const [paymentDay, setPaymentDay] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [semDataFim, setSemDataFim] = useState(true);

  const { setOnAdicionar } = useHeaderActionsStore();

  const categoriasPorId = Object.fromEntries(categoriasDB.map((c) => [c.id, c]));
  const contasPorId = Object.fromEntries(contasDB.map((c) => [c.id, c]));

  // ── Carregamento ─────────────────────────────────────────────────────────────

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, cats, contas] = await Promise.all([
        listarReceitas(),
        listarCategoriasReceita(),
        listarContas(),
      ]);
      setReceitas(lista);
      setCategoriasDB(cats);
      setContasDB(contas);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar receitas",
        mensagemUsuario: "Não foi possível carregar as receitas.",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ── Modal ──────────────────────────────────────────────────────────────────

  const abrirModalNovo = useCallback(() => {
    setEditando(null);
    setNome("");
    setDescricao("");
    setAccountId(null);
    setCategoryId("");
    setModalidade("PJ");
    setTipo("FIXO");
    setAmountCents(0);
    setHourlyRateCents(0);
    setHoursPerDay(HORAS_PADRAO);
    setPaymentDay("");
    setStartDate(hoje());
    setEndDate("");
    setSemDataFim(true);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }, []);

  function abrirModalEditar(r: Receita) {
    setEditando(r);
    setNome(r.name);
    setDescricao(r.descricao ?? "");
    setAccountId(r.accountId);
    setCategoryId(r.categoryId ?? "");
    setModalidade(r.modalidade);
    setTipo(r.tipo);
    setAmountCents(r.tipo === "FIXO" ? r.amountCents : 0);
    setHourlyRateCents(r.hourlyRateCents ?? 0);
    setHoursPerDay(r.hoursPerDay ?? HORAS_PADRAO);
    setPaymentDay(r.paymentDay ?? "");
    setStartDate(r.startDate ?? "");
    setEndDate(r.endDate ?? "");
    setSemDataFim(r.endDate == null);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
    setConfirmandoExclusao(false);
    setErroModal(null);
  }

  useEffect(() => {
    setOnAdicionar(abrirModalNovo);
    return () => setOnAdicionar(null);
  }, [abrirModalNovo, setOnAdicionar]);

  // ── Derivados do formulário ─────────────────────────────────────────────────

  const valorMensalPreview = calcularValorMensal(
    {
      tipo,
      amountCents,
      hourlyRateCents,
      hoursPerDay: hoursPerDay === "" ? null : hoursPerDay,
    },
    DIAS_UTEIS_MES
  );

  const valorValido =
    tipo === "FIXO"
      ? amountCents > 0
      : hourlyRateCents > 0 && hoursPerDay !== "" && hoursPerDay > 0;

  // CLT: estima descontos/líquido a partir do valor mensal bruto.
  const cltPreview =
    modalidade === "CLT" && valorMensalPreview > 0 ? calcularCLT(valorMensalPreview) : null;

  const podeSalvar = nome.trim().length > 0 && valorValido && !salvando;

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function salvar() {
    setErroModal(null);
    if (!nome.trim()) {
      setErroModal("Informe o nome da receita.");
      return;
    }
    if (tipo === "FIXO" && amountCents <= 0) {
      setErroModal("Informe o valor da receita.");
      return;
    }
    if (tipo === "HORA" && !valorValido) {
      setErroModal("Para receita por hora, informe o valor da hora e as horas por dia.");
      return;
    }
    if (!semDataFim && startDate && endDate && endDate < startDate) {
      setErroModal("A data de finalização não pode ser anterior à data de início.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        name: nome.trim(),
        descricao: descricao.trim() || null,
        accountId,
        categoryId: categoryId || null,
        modalidade,
        tipo,
        amountCents,
        hourlyRateCents: tipo === "HORA" ? hourlyRateCents : null,
        hoursPerDay: tipo === "HORA" && hoursPerDay !== "" ? hoursPerDay : null,
        paymentDay: paymentDay === "" ? null : paymentDay,
        startDate: startDate || null,
        endDate: semDataFim ? null : endDate || null,
      };
      if (editando) {
        await editarReceita(editando.id, dados);
      } else {
        await criarReceita(dados);
      }
      await carregarDados();
      setModalAberto(false);
      setEditando(null);
      toast.sucesso(editando ? "Receita atualizada" : "Receita adicionada");
    } catch (e) {
      setErroModal(
        tratarErro(e, {
          contexto: "salvar receita",
          mensagemUsuario: "Não foi possível salvar a receita.",
        })
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!editando) return;
    setExcluindo(true);
    try {
      await excluirReceita(editando.id);
      await carregarDados();
      setModalAberto(false);
      setEditando(null);
      setConfirmandoExclusao(false);
      toast.sucesso("Receita excluída");
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir receita",
        mensagemUsuario: "Não foi possível excluir a receita.",
      });
    } finally {
      setExcluindo(false);
    }
  }

  // ── Click-outside menu de ordenação ─────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuOrdemRef.current && !menuOrdemRef.current.contains(e.target as Node)) {
        setMenuOrdemAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const stats = computarStats(receitas);

  const receitasExibidas = receitas
    .filter((r) => {
      if (filtro === "fixas" && r.tipo !== "FIXO") return false;
      if (filtro === "hora" && r.tipo !== "HORA") return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        return (
          r.name.toLowerCase().includes(termo) ||
          (r.descricao?.toLowerCase().includes(termo) ?? false) ||
          (r.accountId ? contasPorId[r.accountId]?.name.toLowerCase().includes(termo) ?? false : false)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (ordenacao === "MAIOR") return valorMes(b) - valorMes(a);
      if (ordenacao === "MENOR") return valorMes(a) - valorMes(b);
      if (ordenacao === "AZ") return a.name.localeCompare(b.name, "pt-BR");
      return b.name.localeCompare(a.name, "pt-BR");
    });

  const GRID = "minmax(0,1fr) 158px 150px 138px 120px 44px";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">fontes cadastradas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : stats.cadastradas}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">total todo mês</p>
          <p className="text-[22px] font-bold text-positive tabular-nums mt-1">
            {carregando || stats.cadastradas === 0 ? "R$ —" : formatarBRL(stats.totalMensal)}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">valor fixo</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando || stats.countFixo === 0 ? "R$ —" : formatarBRL(stats.totalFixo)}
          </p>
          <p className="text-[11px] font-medium text-ink-muted mt-0.5">{stats.countFixo} fonte(s)</p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">por hora</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando || stats.countHora === 0 ? "R$ —" : formatarBRL(stats.totalHora)}
          </p>
          <p className="text-[11px] font-medium text-ink-muted mt-0.5">{stats.countHora} fonte(s)</p>
        </div>
      </div>

      {/* Filtros + busca */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 w-60 h-10 px-3.5 bg-surface border border-border rounded-xl">
            <IconBusca />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar receita…"
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
            />
          </div>
          {(["todas", "fixas", "hora"] as Filtro[]).map((f) => {
            const ativo = filtro === f;
            const label = f === "todas" ? "Todas" : f === "fixas" ? "Valor fixo" : "Por hora";
            return (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className="h-9 px-4 rounded-full text-sm font-semibold transition-colors"
                style={{
                  border: ativo ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                  background: ativo ? "#EAF1FD" : "#fff",
                  color: ativo ? "#2F63C9" : "#5B616E",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Ordenação */}
        <div className="relative" ref={menuOrdemRef}>
          <button
            onClick={() => setMenuOrdemAberto((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-surface text-ink-secondary text-sm font-semibold hover:bg-surface-subtle transition-colors"
          >
            {ORDENACAO_LABEL[ordenacao]}
            <IconChevron />
          </button>
          {menuOrdemAberto && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-surface border border-border rounded-xl shadow-lg py-1 w-36 overflow-hidden">
              {(["MAIOR", "MENOR", "AZ", "ZA"] as Ordenacao[]).map((op) => (
                <button
                  key={op}
                  onClick={() => {
                    setOrdenacao(op);
                    setMenuOrdemAberto(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium hover:bg-surface-subtle transition-colors"
                  style={{ color: ordenacao === op ? "#2F63C9" : "#0E1116" }}
                >
                  {ORDENACAO_LABEL[op]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center" style={{ gridTemplateColumns: GRID }}>
          <span className="text-xs font-semibold text-ink-muted">Fonte</span>
          <span className="text-xs font-semibold text-ink-muted">Tipo</span>
          <span className="text-xs font-semibold text-ink-muted">Conta</span>
          <span className="text-xs font-semibold text-ink-muted">Quando</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Valor / mês</span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : receitasExibidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-1">
            <p className="text-sm font-medium text-ink-muted">
              {busca || filtro !== "todas"
                ? "Nenhuma receita encontrada para este filtro."
                : "Nenhuma receita cadastrada ainda."}
            </p>
            {!busca && filtro === "todas" && (
              <p className="text-xs text-ink-placeholder">
                Clique em "Adicionar" para cadastrar sua primeira fonte de renda.
              </p>
            )}
          </div>
        ) : (
          receitasExibidas.map((r, i) => {
            const cat = r.categoryId ? categoriasPorId[r.categoryId] : null;
            const conta = r.accountId ? contasPorId[r.accountId] : null;
            const periodo = descreverPeriodo(r.startDate, r.endDate);
            const ehHora = r.tipo === "HORA";
            return (
              <div key={r.id}>
                <div
                  className="grid px-5 items-center group"
                  style={{ gridTemplateColumns: GRID, minHeight: "62px" }}
                >
                  {/* Fonte (+ descrição/categoria) */}
                  <div className="py-3 pr-4 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-[14px] font-semibold text-ink leading-snug truncate">
                        {r.name}
                      </p>
                      <span
                        className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                        style={{
                          background: r.modalidade === "CLT" ? "#E2F4EC" : "#F0F2F6",
                          color: r.modalidade === "CLT" ? "#0B6E4A" : "#5B616E",
                        }}
                      >
                        {MODALIDADE_LABEL[r.modalidade]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      {cat && (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                          <span className="text-[12px] font-medium text-ink-muted">{cat.name}</span>
                        </span>
                      )}
                      {cat && r.descricao && <span className="text-ink-placeholder text-[12px]">·</span>}
                      {r.descricao && (
                        <span className="text-[12px] font-medium text-ink-muted truncate">{r.descricao}</span>
                      )}
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="py-3 pr-4 min-w-0">
                    <span
                      className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[12px] font-semibold"
                      style={{
                        background: ehHora ? "#FBF1E0" : "#E8EEFB",
                        color: ehHora ? "#9A6B12" : "#2F63C9",
                      }}
                    >
                      {ehHora ? "Por hora" : "Valor fixo"}
                    </span>
                    {ehHora && (
                      <p className="text-[11px] font-medium text-ink-muted mt-1 truncate">{detalheHora(r)}</p>
                    )}
                  </div>

                  {/* Conta */}
                  <div className="py-3 pr-4 min-w-0">
                    {conta ? (
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <ContaAvatar icon={conta.icon} cor={conta.color} size={24} />
                        <span className="text-[13px] font-medium text-ink-secondary truncate">{conta.name}</span>
                      </span>
                    ) : (
                      <span className="text-[13px] font-medium text-ink-placeholder">—</span>
                    )}
                  </div>

                  {/* Quando */}
                  <div className="py-3 pr-4 min-w-0">
                    {r.paymentDay ? (
                      <p className="text-[13px] font-medium text-ink-secondary">todo dia {r.paymentDay}</p>
                    ) : (
                      <p className="text-[13px] font-medium text-ink-placeholder">sem dia fixo</p>
                    )}
                    {periodo && <p className="text-[11px] font-medium text-ink-muted mt-0.5 truncate">{periodo}</p>}
                  </div>

                  {/* Valor */}
                  <div className="py-3 text-right">
                    <p className="text-[14px] font-semibold text-positive tabular-nums">
                      {formatarBRL(valorMes(r))}
                    </p>
                    {r.modalidade === "CLT" && valorMes(r) > 0 && (
                      <p className="text-[11px] font-medium text-ink-muted tabular-nums mt-0.5">
                        líq. {formatarBRL(calcularCLT(valorMes(r)).liquidoCents)}
                      </p>
                    )}
                  </div>

                  {/* Editar */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => abrirModalEditar(r)}
                      aria-label="Editar receita"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
                {i < receitasExibidas.length - 1 && <div className="h-px bg-border-subtle mx-5" />}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[80]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={fecharModal}
        >
          <div
            className="w-[600px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
            style={{ padding: "30px 30px 26px", maxHeight: "calc(100vh - 48px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmandoExclusao ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[21px] font-bold text-ink tracking-tight">Excluir receita</p>
                  <button
                    onClick={() => setConfirmandoExclusao(false)}
                    aria-label="Voltar"
                    className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ background: "#F0F2F6", color: "#5B616E" }}
                  >
                    <IconFechar />
                  </button>
                </div>
                <div className="rounded-2xl p-4 mb-6" style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}>
                  <p className="text-[14px] font-semibold text-[#991B1B]">Isso não pode ser desfeito</p>
                  <p className="text-[13px] text-[#7F1D1D] mt-1">
                    A receita <strong>{editando?.name}</strong> será removida permanentemente.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setConfirmandoExclusao(false)}
                    className="flex-1 h-12 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                    style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={excluir}
                    disabled={excluindo}
                    className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] disabled:opacity-50 transition-opacity"
                    style={{ background: "#D74A45" }}
                  >
                    {excluindo ? "Excluindo…" : "Excluir mesmo assim"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Cabeçalho */}
                <div className="flex items-center justify-between mb-[22px]">
                  <p className="text-[21px] font-bold text-ink tracking-tight">
                    {editando ? "Editar receita" : "Nova receita"}
                  </p>
                  <button
                    onClick={fecharModal}
                    disabled={salvando}
                    aria-label="Fechar"
                    className="w-[34px] h-[34px] rounded-full border-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
                    style={{ background: "#F0F2F6", color: "#5B616E" }}
                  >
                    <IconFechar />
                  </button>
                </div>

                {/* Nome */}
                <label className="block mb-4">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Nome da receita</span>
                  <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Salário, Freelance, Aluguel recebido…"
                      autoFocus
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>

                {/* Descrição */}
                <label className="block mb-4">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                    Descrição <span className="font-normal text-ink-muted">(opcional)</span>
                  </span>
                  <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
                    <input
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex: Contrato PJ com a Empresa X…"
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>

                {/* Conta + Categoria */}
                <div className="flex gap-3 mb-5">
                  <div className="flex-1 min-w-0">
                    <SeletorConta
                      label="Conta"
                      value={accountId}
                      onChange={setAccountId}
                      origem={{ type: "INCOME", isTemplate: true }}
                      autoSelecionarPrincipal={editando === null}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <SeletorCategoria
                      label="Categoria (opcional)"
                      value={categoryId || null}
                      onChange={(id) => setCategoryId(id ?? "")}
                      tipo="INCOME"
                      origem={{ type: "INCOME", isTemplate: true }}
                    />
                  </div>
                </div>

                {/* Tipo de receita */}
                <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">Tipo de receita</p>
                <div className="flex gap-2 mb-4">
                  {[
                    { t: "FIXO" as TipoReceita, label: "Valor fixo", sub: "o mesmo valor todo mês" },
                    { t: "HORA" as TipoReceita, label: "Valor por hora", sub: "calculado por horas trabalhadas" },
                  ].map((opt) => {
                    const ativo = tipo === opt.t;
                    return (
                      <button
                        key={opt.t}
                        onClick={() => setTipo(opt.t)}
                        className="flex-1 rounded-xl px-4 py-3 text-left transition-colors"
                        style={{
                          border: ativo ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                          background: ativo ? "#EAF1FD" : "#fff",
                        }}
                      >
                        <p className="text-[14px] font-semibold" style={{ color: ativo ? "#2F63C9" : "#0E1116" }}>
                          {opt.label}
                        </p>
                        <p className="text-[12px] font-medium mt-0.5" style={{ color: ativo ? "#2F63C9" : "#5B616E" }}>
                          {opt.sub}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Campos por tipo — modalidade fica na mesma linha do valor + dia */}
                {tipo === "FIXO" ? (
                  <div className="flex gap-3 mb-4 items-start">
                    <div className="flex-1 min-w-0">
                      <CampoSelect
                        label="Modalidade"
                        value={modalidade}
                        onChange={setModalidade}
                        options={MODALIDADE_OPCOES}
                      />
                    </div>
                    <label className="flex-1 block min-w-0">
                      <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                        {modalidade === "CLT" ? "Valor bruto" : "Valor"}
                      </span>
                      <MoneyInput centavos={amountCents} onChange={setAmountCents} placeholder="0,00" />
                    </label>
                    <div className="w-[96px] shrink-0">
                      <CampoNumero
                        label="Dia"
                        value={paymentDay}
                        onChange={setPaymentDay}
                        min={1}
                        max={31}
                        placeholder="5"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 mb-3 items-start">
                      <div className="flex-1 min-w-0">
                        <CampoSelect
                          label="Modalidade"
                          value={modalidade}
                          onChange={setModalidade}
                          options={MODALIDADE_OPCOES}
                        />
                      </div>
                      <label className="flex-1 block min-w-0">
                        <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                          {modalidade === "CLT" ? "Valor da hora (bruto)" : "Valor da hora"}
                        </span>
                        <MoneyInput centavos={hourlyRateCents} onChange={setHourlyRateCents} placeholder="0,00" />
                      </label>
                      <div className="w-[104px] shrink-0">
                        <CampoNumero
                          label="Horas/dia"
                          value={hoursPerDay}
                          onChange={setHoursPerDay}
                          min={1}
                          max={24}
                          placeholder="8"
                        />
                      </div>
                      <div className="w-[80px] shrink-0">
                        <CampoNumero
                          label="Dia"
                          value={paymentDay}
                          onChange={setPaymentDay}
                          min={1}
                          max={31}
                          placeholder="5"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-2" style={{ border: "1px solid #E3E6EC", background: "#F6FAF7" }}>
                      <span className="text-[13px] font-semibold text-[#5B616E]">
                        Estimado em {formatarMesAno(MES_ATUAL, ANO_ATUAL)}
                      </span>
                      <span className="text-[15px] font-bold text-positive tabular-nums">
                        {valorMensalPreview > 0 ? formatarBRL(valorMensalPreview) : "R$ —"}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-muted mb-4">
                      Cálculo: valor da hora × horas por dia × dias úteis do mês. Em{" "}
                      {formatarMesAno(MES_ATUAL, ANO_ATUAL)} são <strong>{DIAS_UTEIS_MES} dias úteis</strong> (descontando
                      fins de semana e feriados nacionais); o valor é recalculado a cada mês.
                    </p>
                  </>
                )}

                {/* Estimativa CLT — líquido e impostos retidos */}
                {cltPreview && (
                  <div className="rounded-2xl p-4 mb-5" style={{ border: "1px solid #DCE7F7", background: "#F4F8FE" }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[13px] font-bold text-[#2F63C9]">
                        Estimativa CLT · tabelas {CLT_ANO_REFERENCIA}
                      </p>
                      <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                        valor = bruto
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-ink-secondary">Salário bruto</span>
                        <span className="text-[13px] font-semibold text-ink tabular-nums">{formatarBRL(cltPreview.brutoCents)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-ink-secondary">INSS</span>
                        <span className="text-[13px] font-semibold text-negative tabular-nums">− {formatarBRL(cltPreview.inssCents)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-ink-secondary">IRRF</span>
                        <span className="text-[13px] font-semibold text-negative tabular-nums">− {formatarBRL(cltPreview.irrfCents)}</span>
                      </div>
                      <div className="h-px bg-[#DCE7F7] my-1.5" />
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-bold text-ink">Líquido estimado</span>
                        <span className="text-[15px] font-bold text-positive tabular-nums">{formatarBRL(cltPreview.liquidoCents)}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-ink-muted mt-3 leading-relaxed">
                      + FGTS de <strong>{formatarBRL(cltPreview.fgtsCents)}</strong> depositado pelo empregador (não descontado do salário).
                      Estimativa sem dependentes/outras deduções — o valor real na folha pode variar.
                    </p>
                  </div>
                )}

                {/* Período */}
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[13px] font-semibold text-[#5B616E]">Período</p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={semDataFim}
                      onChange={(e) => {
                        setSemDataFim(e.target.checked);
                        if (e.target.checked) setEndDate("");
                      }}
                      className="w-4 h-4 accent-brand cursor-pointer"
                    />
                    <span className="text-[13px] font-medium text-ink-secondary">Não tem data de finalização</span>
                  </label>
                </div>
                <div className="flex gap-3 mb-6">
                  <CampoData label="Data de início" value={startDate} onChange={setStartDate} />
                  <CampoData
                    label="Data de finalização"
                    value={endDate}
                    onChange={setEndDate}
                    disabled={semDataFim}
                    min={startDate || undefined}
                  />
                </div>

                {/* Erro */}
                {erroModal && (
                  <div className="rounded-xl px-4 py-3 mb-4 text-[13px] font-medium" style={{ background: "#FBE9E7", color: "#9B1C1C", border: "1px solid #FCA5A5" }}>
                    {erroModal}
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2.5">
                  {editando ? (
                    <button
                      onClick={() => setConfirmandoExclusao(true)}
                      className="shrink-0 h-12 px-4 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                      style={{ border: "1px solid #F5C5C3", background: "#FEF2F2", color: "#D74A45" }}
                    >
                      Excluir
                    </button>
                  ) : (
                    <button
                      onClick={fecharModal}
                      className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                      style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={salvar}
                    disabled={!podeSalvar}
                    className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: "#4078E6", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
                  >
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar receita"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
