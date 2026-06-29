import { useState, useEffect, useCallback, useRef } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { formatarBRL } from "@/utils/money";
import { getDb } from "@/core/db/client";
import { transactions, categories } from "@/core/db/schema";
import type { Category } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CustoDeVida {
  id: string;
  descricao: string;
  amountCents: number;
  isFixo: boolean;
  lcDayOfMonth: number | null;
  categoryId: string | null;
}

type FiltroTipo = "TODOS" | "FIXO" | "VARIAVEL";
type OrdenacaoTipo = "MAIOR" | "MENOR" | "AZ" | "ZA";

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function dbListarCustos(): Promise<CustoDeVida[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amountCents: transactions.amountCents,
      isRecurring: transactions.isRecurring,
      lcDayOfMonth: transactions.lcDayOfMonth,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(eq(transactions.type, "LIVING_COST"), eq(transactions.isTemplate, 1))
    );

  return rows.map((r) => ({
    id: r.id,
    descricao: r.description,
    amountCents: r.amountCents ?? 0,
    isFixo: r.isRecurring === 1,
    lcDayOfMonth: r.lcDayOfMonth ?? null,
    categoryId: r.categoryId ?? null,
  }));
}

async function dbCriarCusto(dados: {
  descricao: string;
  amountCents: number;
  isFixo: boolean;
  lcDayOfMonth: number | null;
  categoryId: string | null;
}): Promise<void> {
  const db = await getDb();
  const agora = new Date().toISOString();
  await db.insert(transactions).values({
    id: `lc_${uuidv4()}`,
    type: "LIVING_COST",
    status: "ATIVO",
    description: dados.descricao,
    amountCents: dados.amountCents,
    isTemplate: 1,
    isRecurring: dados.isFixo ? 1 : 0,
    lcDayOfMonth: dados.lcDayOfMonth,
    categoryId: dados.categoryId,
    createdAt: agora,
    updatedAt: agora,
  });
}

async function dbEditarCusto(
  id: string,
  dados: {
    descricao: string;
    amountCents: number;
    isFixo: boolean;
    lcDayOfMonth: number | null;
    categoryId: string | null;
  }
): Promise<void> {
  const db = await getDb();
  await db
    .update(transactions)
    .set({
      description: dados.descricao,
      amountCents: dados.amountCents,
      isRecurring: dados.isFixo ? 1 : 0,
      lcDayOfMonth: dados.lcDayOfMonth,
      categoryId: dados.categoryId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(transactions.id, id));
}

async function dbDeletarCusto(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(transactions).where(eq(transactions.id, id));
}

async function dbListarCategorias(): Promise<Category[]> {
  const db = await getDb();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.type, "EXPENSE"), eq(categories.archived, 0)));
}

// ─── Helpers de exibição ──────────────────────────────────────────────────────

function etiquetaFrequencia(custo: CustoDeVida): string {
  if (!custo.isFixo) return "Variável";
  if (custo.lcDayOfMonth) return `Fixo · todo dia ${custo.lcDayOfMonth}`;
  return "Fixo";
}

// ─── Ícone de três pontos ─────────────────────────────────────────────────────

function IconeMenu() {
  return (
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
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function CustoDeVidaScreen() {
  // ── Dados ─────────────────────────────────────────────────────────────────
  const [custos, setCustos] = useState<CustoDeVida[]>([]);
  const [categoriasDB, setCategoriasDB] = useState<Category[]>([]);
  const [carregando, setCarregando] = useState(true);

  // ── Filtros e ordenação ───────────────────────────────────────────────────
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroTipo>("TODOS");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTipo>("MAIOR");
  const [menuOrdemAberto, setMenuOrdemAberto] = useState(false);
  const menuOrdemRef = useRef<HTMLDivElement>(null);

  // ── Menu de linha ──────────────────────────────────────────────────────────
  const [menuLinhaId, setMenuLinhaId] = useState<string | null>(null);
  const menuLinhaRef = useRef<HTMLDivElement>(null);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Campos do modal
  const [descricao, setDescricao] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [isFixo, setIsFixo] = useState(true);
  const [lcDayOfMonth, setLcDayOfMonth] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<string>("");

  // ── Confirmação de exclusão ────────────────────────────────────────────────
  const [confirmarDeletarId, setConfirmarDeletarId] = useState<string | null>(null);
  const [deletando, setDeletando] = useState(false);

  const { setOnAdicionar } = useHeaderActionsStore();

  // ── Mapa de categorias ────────────────────────────────────────────────────
  const categoriasPorId = Object.fromEntries(categoriasDB.map((c) => [c.id, c]));

  // ── Carregamento ──────────────────────────────────────────────────────────

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [listaCustos, listaCats] = await Promise.all([
        dbListarCustos(),
        dbListarCategorias(),
      ]);
      setCustos(listaCustos);
      setCategoriasDB(listaCats);
    } catch (err) {
      console.error("Erro ao carregar custos de vida:", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ── Modal ──────────────────────────────────────────────────────────────────

  function abrirModalNovo() {
    setEditandoId(null);
    setDescricao("");
    setAmountCents(0);
    setIsFixo(true);
    setLcDayOfMonth("");
    setCategoryId("");
    setModalAberto(true);
  }

  function abrirModalEditar(custo: CustoDeVida) {
    setMenuLinhaId(null);
    setEditandoId(custo.id);
    setDescricao(custo.descricao);
    setAmountCents(custo.amountCents);
    setIsFixo(custo.isFixo);
    setLcDayOfMonth(custo.lcDayOfMonth ?? "");
    setCategoryId(custo.categoryId ?? "");
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditandoId(null);
  }

  async function salvar() {
    if (!descricao.trim()) return;
    setSalvando(true);
    try {
      const dados = {
        descricao: descricao.trim(),
        amountCents,
        isFixo,
        lcDayOfMonth: lcDayOfMonth === "" ? null : Number(lcDayOfMonth),
        categoryId: categoryId || null,
      };
      if (editandoId) {
        await dbEditarCusto(editandoId, dados);
      } else {
        await dbCriarCusto(dados);
      }
      await carregarDados();
      fecharModal();
    } catch (err) {
      console.error("Erro ao salvar custo de vida:", err);
    } finally {
      setSalvando(false);
    }
  }

  // ── Exclusão ──────────────────────────────────────────────────────────────

  function pedirConfirmacaoDeletar(id: string) {
    setMenuLinhaId(null);
    setConfirmarDeletarId(id);
  }

  async function confirmarDeletar() {
    if (!confirmarDeletarId) return;
    setDeletando(true);
    try {
      await dbDeletarCusto(confirmarDeletarId);
      await carregarDados();
      setConfirmarDeletarId(null);
    } catch (err) {
      console.error("Erro ao deletar custo de vida:", err);
    } finally {
      setDeletando(false);
    }
  }

  // ── Click-outside para menus ──────────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuOrdemRef.current &&
        !menuOrdemRef.current.contains(e.target as Node)
      ) {
        setMenuOrdemAberto(false);
      }
      if (
        menuLinhaRef.current &&
        !menuLinhaRef.current.contains(e.target as Node)
      ) {
        setMenuLinhaId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Botão Adicionar no header ─────────────────────────────────────────────

  useEffect(() => {
    setOnAdicionar(abrirModalNovo);
    return () => setOnAdicionar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dados computados ──────────────────────────────────────────────────────

  const totalFixo = custos
    .filter((c) => c.isFixo)
    .reduce((soma, c) => soma + c.amountCents, 0);

  const totalVariavel = custos
    .filter((c) => !c.isFixo)
    .reduce((soma, c) => soma + c.amountCents, 0);

  const custosExibidos = custos
    .filter((c) => {
      if (filtro === "FIXO" && !c.isFixo) return false;
      if (filtro === "VARIAVEL" && c.isFixo) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const bateDescricao = c.descricao.toLowerCase().includes(termo);
        const bateCategoria =
          categoriasPorId[c.categoryId ?? ""]?.name
            .toLowerCase()
            .includes(termo) ?? false;
        return bateDescricao || bateCategoria;
      }
      return true;
    })
    .sort((a, b) => {
      if (ordenacao === "MAIOR") return b.amountCents - a.amountCents;
      if (ordenacao === "MENOR") return a.amountCents - b.amountCents;
      if (ordenacao === "AZ")
        return a.descricao.localeCompare(b.descricao, "pt-BR");
      return b.descricao.localeCompare(a.descricao, "pt-BR");
    });

  const ORDENACAO_LABEL: Record<OrdenacaoTipo, string> = {
    MAIOR: "Maior valor",
    MENOR: "Menor valor",
    AZ: "A–Z",
    ZA: "Z–A",
  };

  const custoPorId = Object.fromEntries(custos.map((c) => [c.id, c]));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            itens cadastrados
          </p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : custos.length}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            custo fixo
          </p>
          <p className="text-[22px] font-bold text-negative tabular-nums mt-1">
            {carregando || !custos.some((c) => c.isFixo)
              ? "R$ —"
              : formatarBRL(totalFixo)}
          </p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            custo variável
          </p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando || !custos.some((c) => !c.isFixo)
              ? "R$ —"
              : formatarBRL(totalVariavel)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Campo de busca */}
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
              placeholder="Buscar despesa…"
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
            />
          </div>

          {/* Pills de filtro */}
          {(["TODOS", "FIXO", "VARIAVEL"] as FiltroTipo[]).map((f) => {
            const ativo = filtro === f;
            const label =
              f === "TODOS" ? "Todos" : f === "FIXO" ? "Fixos" : "Variáveis";
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

        {/* Menu de ordenação */}
        <div className="relative" ref={menuOrdemRef}>
          <button
            onClick={() => setMenuOrdemAberto((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-surface text-ink-secondary text-sm font-semibold hover:bg-surface-subtle transition-colors"
          >
            {ORDENACAO_LABEL[ordenacao]}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {menuOrdemAberto && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-surface border border-border rounded-xl shadow-lg py-1 w-36 overflow-hidden">
              {(["MAIOR", "MENOR", "AZ", "ZA"] as OrdenacaoTipo[]).map((op) => (
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
        <div
          className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center"
          style={{
            gridTemplateColumns: "minmax(0,1fr) 160px 210px 150px 44px",
          }}
        >
          <span className="text-xs font-semibold text-ink-muted">Despesa</span>
          <span className="text-xs font-semibold text-ink-muted">Categoria</span>
          <span className="text-xs font-semibold text-ink-muted">Frequência</span>
          <span className="text-xs font-semibold text-ink-muted text-right">
            Valor
          </span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : custosExibidos.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            {busca || filtro !== "TODOS"
              ? "Nenhum resultado encontrado."
              : "Nenhuma despesa de custo de vida cadastrada ainda."}
          </div>
        ) : (
          custosExibidos.map((custo, i) => {
            const cat = custo.categoryId
              ? categoriasPorId[custo.categoryId]
              : null;
            return (
              <div key={custo.id}>
                <div
                  className="grid px-5 items-center"
                  style={{
                    gridTemplateColumns:
                      "minmax(0,1fr) 160px 210px 150px 44px",
                    minHeight: "56px",
                  }}
                >
                  {/* Nome da despesa */}
                  <div className="py-3.5 pr-4">
                    <p className="text-[14px] font-semibold text-ink leading-snug truncate">
                      {custo.descricao}
                    </p>
                  </div>

                  {/* Categoria */}
                  <div className="py-3.5 pr-4">
                    {cat ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: cat.color }}
                        />
                        <span className="text-[13px] font-medium text-ink-secondary truncate">
                          {cat.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-muted">—</span>
                    )}
                  </div>

                  {/* Frequência */}
                  <div className="py-3.5 pr-4">
                    <span
                      className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[12px] font-semibold"
                      style={{
                        background: custo.isFixo ? "#E2F4EC" : "#F0F2F6",
                        color: custo.isFixo ? "#0B6E4A" : "#5B616E",
                      }}
                    >
                      {etiquetaFrequencia(custo)}
                    </span>
                  </div>

                  {/* Valor */}
                  <div className="py-3.5 text-right">
                    <p className="text-[14px] font-semibold text-ink tabular-nums">
                      {custo.amountCents > 0
                        ? formatarBRL(custo.amountCents)
                        : "—"}
                    </p>
                  </div>

                  {/* Menu de ações */}
                  <div
                    className="relative flex items-center justify-center"
                    ref={menuLinhaId === custo.id ? menuLinhaRef : undefined}
                  >
                    <button
                      onClick={() =>
                        setMenuLinhaId((prev) =>
                          prev === custo.id ? null : custo.id
                        )
                      }
                      className="w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-subtle transition-colors"
                    >
                      <IconeMenu />
                    </button>
                    {menuLinhaId === custo.id && (
                      <div className="absolute right-0 top-[calc(100%+2px)] z-50 bg-surface border border-border rounded-xl shadow-lg py-1 w-32 overflow-hidden">
                        <button
                          onClick={() => abrirModalEditar(custo)}
                          className="w-full text-left px-4 py-2 text-sm font-medium text-ink hover:bg-surface-subtle transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => pedirConfirmacaoDeletar(custo.id)}
                          className="w-full text-left px-4 py-2 text-sm font-medium text-negative hover:bg-surface-subtle transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {i < custosExibidos.length - 1 && (
                  <div className="h-px bg-border-subtle mx-5" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de adição / edição */}
      {modalAberto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[80]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={fecharModal}
        >
          <div
            className="w-[480px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
            style={{ padding: "30px 30px 26px", maxHeight: "calc(100vh - 48px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-[22px]">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                {editandoId ? "Editar despesa" : "Nova despesa"}
              </p>
              <button
                onClick={fecharModal}
                disabled={salvando}
                aria-label="Fechar"
                className="w-[34px] h-[34px] rounded-full border-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
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
            <label className="block mb-4">
              <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                Como se chama essa despesa?
              </span>
              <span
                className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={{ border: "1px solid #D4D8E0" }}
              >
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvar()}
                  placeholder="Ex: Aluguel, Internet, Academia…"
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                />
              </span>
            </label>

            {/* Tipo: Fixo / Variável */}
            <p className="text-[13px] font-semibold text-[#5B616E] mt-1.5 mb-2.5">
              Esse custo é fixo ou varia todo mês?
            </p>
            <div className="flex gap-2 mb-5">
              {[
                {
                  valor: true,
                  label: "Fixo",
                  desc: "mesmo valor todo mês",
                },
                {
                  valor: false,
                  label: "Variável",
                  desc: "muda de mês em mês",
                },
              ].map((op) => {
                const ativo = isFixo === op.valor;
                return (
                  <button
                    key={String(op.valor)}
                    onClick={() => setIsFixo(op.valor)}
                    className="flex-1 py-3 px-4 rounded-xl text-left cursor-pointer transition-all"
                    style={{
                      border: ativo
                        ? "1.5px solid #87BBF8"
                        : "1.5px solid #E3E6EC",
                      background: ativo ? "#EAF1FD" : "#F7F8FA",
                    }}
                  >
                    <p
                      className="text-[14px] font-semibold"
                      style={{ color: ativo ? "#2F63C9" : "#0E1116" }}
                    >
                      {op.label}
                    </p>
                    <p className="text-[12px] font-medium text-[#5B616E] mt-0.5">
                      {op.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Valor + Dia do mês (lado a lado quando fixo) */}
            <div className={`flex gap-3 mb-4 ${isFixo ? "" : ""}`}>
              <label className="flex-1 block">
                <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                  {isFixo
                    ? "Quanto custa?"
                    : "Quanto costuma custar? (estimativa)"}
                </span>
                <MoneyInput
                  centavos={amountCents}
                  onChange={setAmountCents}
                  placeholder="0,00"
                />
              </label>

              {isFixo && (
                <label className="flex-1 block">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                    Dia do mês{" "}
                    <span className="font-normal text-ink-muted">(opcional)</span>
                  </span>
                  <span
                    className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                    style={{ border: "1px solid #D4D8E0" }}
                  >
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={lcDayOfMonth}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setLcDayOfMonth("");
                          return;
                        }
                        const n = parseInt(val, 10);
                        if (!isNaN(n)) {
                          setLcDayOfMonth(Math.min(31, Math.max(1, n)));
                        }
                      }}
                      placeholder="Ex: 5, 15…"
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>
              )}
            </div>

            {/* Categoria */}
            {categoriasDB.length > 0 && (
              <label className="block mb-6">
                <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                  Categoria{" "}
                  <span className="font-normal text-ink-muted">(opcional)</span>
                </span>
                <span
                  className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                  style={{ border: "1px solid #D4D8E0" }}
                >
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink font-sans cursor-pointer appearance-none"
                  >
                    <option value="">Sem categoria</option>
                    {categoriasDB.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-ink-muted shrink-0 pointer-events-none"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </label>
            )}

            {/* Ações */}
            <div
              className="flex gap-2.5"
              style={{ marginTop: categoriasDB.length === 0 ? "8px" : "0" }}
            >
              <button
                onClick={fecharModal}
                disabled={salvando}
                className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: "1px solid #D4D8E0",
                  background: "#fff",
                  color: "#0E1116",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={!descricao.trim() || salvando}
                className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  background: "#4078E6",
                  boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
                }}
              >
                {salvando
                  ? "Salvando…"
                  : editandoId
                  ? "Salvar alterações"
                  : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmarDeletarId && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[90]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={() => !deletando && setConfirmarDeletarId(null)}
        >
          <div
            className="w-[380px] bg-surface rounded-2xl shadow-lg animate-slide-up"
            style={{ padding: "28px 28px 22px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[18px] font-bold text-ink mb-1">
              Excluir despesa
            </p>
            <p className="text-[14px] text-ink-secondary mb-6">
              <strong className="text-ink">
                {custoPorId[confirmarDeletarId]?.descricao}
              </strong>{" "}
              será removida permanentemente do seu custo de vida.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmarDeletarId(null)}
                disabled={deletando}
                className="flex-1 h-11 rounded-full font-semibold text-[14px] cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{
                  border: "1px solid #D4D8E0",
                  background: "#fff",
                  color: "#0E1116",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDeletar}
                disabled={deletando}
                className="flex-1 h-11 rounded-full border-none text-white font-semibold text-[14px] cursor-pointer disabled:opacity-50 transition-opacity"
                style={{ background: "#D74A45" }}
              >
                {deletando ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
