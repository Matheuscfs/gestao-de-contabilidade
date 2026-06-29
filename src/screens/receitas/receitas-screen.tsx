import { useState, useEffect, useCallback, useRef } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { formatarBRL } from "@/utils/money";
import {
  listarReceitas,
  criarReceita,
  editarReceita,
  excluirReceita,
  listarCategoriasReceita,
  type Receita,
} from "@/core/db/receitas";
import type { Category } from "@/core/db/schema";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Filtro = "todas" | "recorrentes" | "pontuais";
type Ordenacao = "MAIOR" | "MENOR" | "AZ" | "ZA";

const ORDENACAO_LABEL: Record<Ordenacao, string> = {
  MAIOR: "Maior valor",
  MENOR: "Menor valor",
  AZ: "A–Z",
  ZA: "Z–A",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computarStats(lista: Receita[]) {
  const recorrentes = lista.filter((r) => r.isRecurring);
  const pontuais = lista.filter((r) => !r.isRecurring);
  return {
    cadastradas: lista.length,
    totalRecorrente: recorrentes.reduce((s, r) => s + r.amountCents, 0),
    totalPontual: pontuais.reduce((s, r) => s + r.amountCents, 0),
    temRecorrente: recorrentes.length > 0,
    temPontual: pontuais.length > 0,
  };
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

// ─── Tela principal ───────────────────────────────────────────────────────────

export function ReceitasScreen() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [categoriasDB, setCategoriasDB] = useState<Category[]>([]);
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
  const [descricao, setDescricao] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [isRecurring, setIsRecurring] = useState(true);
  const [pagador, setPagador] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  const { setOnAdicionar } = useHeaderActionsStore();

  const categoriasPorId = Object.fromEntries(categoriasDB.map((c) => [c.id, c]));

  // ── Carregamento ─────────────────────────────────────────────────────────────

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, cats] = await Promise.all([
        listarReceitas(),
        listarCategoriasReceita(),
      ]);
      setReceitas(lista);
      setCategoriasDB(cats);
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
    setDescricao("");
    setAmountCents(0);
    setIsRecurring(true);
    setPagador("");
    setCategoryId("");
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }, []);

  function abrirModalEditar(r: Receita) {
    setEditando(r);
    setDescricao(r.description);
    setAmountCents(r.amountCents);
    setIsRecurring(r.isRecurring);
    setPagador(r.pagador ?? "");
    setCategoryId(r.categoryId ?? "");
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

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const podeSalvar = descricao.trim().length > 0 && amountCents > 0 && !salvando;

  async function salvar() {
    setErroModal(null);
    if (!descricao.trim()) {
      setErroModal("Informe o nome da fonte de receita.");
      return;
    }
    if (amountCents <= 0) {
      setErroModal("Informe o valor da receita.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        description: descricao.trim(),
        amountCents,
        isRecurring,
        pagador: pagador.trim() || null,
        categoryId: categoryId || null,
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
      if (filtro === "recorrentes" && !r.isRecurring) return false;
      if (filtro === "pontuais" && r.isRecurring) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        return (
          r.description.toLowerCase().includes(termo) ||
          (r.pagador?.toLowerCase().includes(termo) ?? false)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (ordenacao === "MAIOR") return b.amountCents - a.amountCents;
      if (ordenacao === "MENOR") return a.amountCents - b.amountCents;
      if (ordenacao === "AZ") return a.description.localeCompare(b.description, "pt-BR");
      return b.description.localeCompare(a.description, "pt-BR");
    });

  const GRID = "minmax(0,1fr) 160px 150px 150px 44px";

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
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">entram todo mês</p>
          <p className="text-[22px] font-bold text-positive tabular-nums mt-1">
            {carregando || !stats.temRecorrente ? "R$ —" : formatarBRL(stats.totalRecorrente)}
          </p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">pontuais</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando || !stats.temPontual ? "R$ —" : formatarBRL(stats.totalPontual)}
          </p>
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
          {(["todas", "recorrentes", "pontuais"] as Filtro[]).map((f) => {
            const ativo = filtro === f;
            const label = f === "todas" ? "Todas" : f === "recorrentes" ? "Recorrentes" : "Pontuais";
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
          <span className="text-xs font-semibold text-ink-muted">De quem</span>
          <span className="text-xs font-semibold text-ink-muted">Recorrência</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Valor</span>
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
            return (
              <div key={r.id}>
                <div
                  className="grid px-5 items-center group"
                  style={{ gridTemplateColumns: GRID, minHeight: "56px" }}
                >
                  {/* Fonte (+ categoria) */}
                  <div className="py-3.5 pr-4 min-w-0">
                    <p className="text-[14px] font-semibold text-ink leading-snug truncate">
                      {r.description}
                    </p>
                    {cat && (
                      <span className="inline-flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                        <span className="text-[12px] font-medium text-ink-muted truncate">{cat.name}</span>
                      </span>
                    )}
                  </div>

                  {/* De quem */}
                  <div className="py-3.5 pr-4">
                    <span className="text-[13px] font-medium text-ink-secondary truncate">
                      {r.pagador || "—"}
                    </span>
                  </div>

                  {/* Recorrência */}
                  <div className="py-3.5 pr-4">
                    <span
                      className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[12px] font-semibold"
                      style={{
                        background: r.isRecurring ? "#E2F4EC" : "#F0F2F6",
                        color: r.isRecurring ? "#0B6E4A" : "#5B616E",
                      }}
                    >
                      {r.isRecurring ? "Recorrente" : "Pontual"}
                    </span>
                  </div>

                  {/* Valor */}
                  <div className="py-3.5 text-right">
                    <p className="text-[14px] font-semibold text-positive tabular-nums">
                      {formatarBRL(r.amountCents)}
                    </p>
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
            className="w-[520px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
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
                    A receita <strong>{editando?.description}</strong> será removida permanentemente.
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

                {/* Fonte */}
                <label className="block mb-4">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Fonte de receita</span>
                  <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
                    <input
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && podeSalvar && salvar()}
                      placeholder="Ex: Salário, Freelance, Aluguel recebido…"
                      autoFocus
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>

                {/* Valor + De quem */}
                <div className="flex gap-3 mb-4">
                  <label className="flex-1 block">
                    <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Valor</span>
                    <MoneyInput centavos={amountCents} onChange={setAmountCents} placeholder="0,00" />
                  </label>
                  <label className="flex-1 block">
                    <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                      De quem <span className="font-normal text-ink-muted">(opcional)</span>
                    </span>
                    <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
                      <input
                        value={pagador}
                        onChange={(e) => setPagador(e.target.value)}
                        placeholder="Ex: Empresa X, Cliente…"
                        className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                      />
                    </span>
                  </label>
                </div>

                {/* Recorrência */}
                <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">Recorrência</p>
                <div className="flex gap-2 mb-5">
                  {[
                    { rec: true, label: "Recorrente", sub: "entra todo mês" },
                    { rec: false, label: "Pontual", sub: "uma vez só" },
                  ].map((opt) => {
                    const ativo = isRecurring === opt.rec;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setIsRecurring(opt.rec)}
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

                {/* Categoria */}
                {categoriasDB.length > 0 && (
                  <div className="mb-6">
                    <span className="block text-[13px] font-semibold text-[#5B616E] mb-2.5">
                      Categoria <span className="font-normal text-ink-muted">(opcional)</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setCategoryId("")}
                        className="h-9 px-4 rounded-full font-semibold text-[13px] transition-colors"
                        style={{
                          border: categoryId === "" ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                          background: categoryId === "" ? "#EAF1FD" : "#fff",
                          color: categoryId === "" ? "#2F63C9" : "#5B616E",
                        }}
                      >
                        Sem categoria
                      </button>
                      {categoriasDB.map((cat) => {
                        const ativo = categoryId === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setCategoryId(ativo ? "" : cat.id)}
                            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full font-semibold text-[13px] transition-colors"
                            style={{
                              border: ativo ? `1px solid ${cat.color}` : "1px solid #E3E6EC",
                              background: ativo ? `${cat.color}18` : "#fff",
                              color: ativo ? cat.color : "#5B616E",
                            }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
