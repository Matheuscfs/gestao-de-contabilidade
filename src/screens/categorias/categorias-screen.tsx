import { useState, useEffect, useCallback } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { useMesStore } from "@/app/mes-store";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  listarCategorias,
  criarCategoria,
  editarCategoria,
  excluirCategoria,
  type CategoriaComUso,
  type TipoCategoria,
} from "@/core/db/categorias";

// ─── Constantes ───────────────────────────────────────────────────────────────

type Filtro = "todas" | "entrada" | "saida";

const CORES: { valor: string; label: string }[] = [
  { valor: "#4078E6", label: "Azul" },
  { valor: "#12A06B", label: "Verde" },
  { valor: "#D74A45", label: "Vermelho" },
  { valor: "#E8A020", label: "Âmbar" },
  { valor: "#EA580C", label: "Laranja" },
  { valor: "#9333EA", label: "Roxo" },
  { valor: "#E11D48", label: "Rosa" },
  { valor: "#0891B2", label: "Ciano" },
  { valor: "#0B6E4A", label: "Verde escuro" },
  { valor: "#1E4BA3", label: "Azul escuro" },
  { valor: "#5B616E", label: "Cinza" },
];

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function CategoriasScreen() {
  const { mes, ano } = useMesStore();

  const [categorias, setCategorias] = useState<CategoriaComUso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<CategoriaComUso | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Campos
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("EXPENSE");
  const [cor, setCor] = useState(CORES[0].valor);

  const { setOnAdicionar } = useHeaderActionsStore();

  // ── Carregamento ─────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await listarCategorias(mes, ano);
      setCategorias(lista);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar categorias",
        mensagemUsuario: "Não foi possível carregar as categorias.",
      });
    } finally {
      setCarregando(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Modal ──────────────────────────────────────────────────────────────────

  const abrirModalNovo = useCallback(() => {
    setEditando(null);
    setNome("");
    setTipo("EXPENSE");
    setCor(CORES[0].valor);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }, []);

  function abrirModalEditar(c: CategoriaComUso) {
    setEditando(c);
    setNome(c.name);
    setTipo(c.type);
    setCor(c.color);
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

  async function salvar() {
    setErroModal(null);
    if (!nome.trim()) {
      setErroModal("Informe o nome da categoria.");
      return;
    }
    setSalvando(true);
    try {
      const dados = { name: nome.trim(), type: tipo, color: cor, icon: "tag" };
      if (editando) {
        await editarCategoria(editando.id, dados);
      } else {
        await criarCategoria(dados);
      }
      await carregar();
      setModalAberto(false);
      setEditando(null);
      toast.sucesso(editando ? "Categoria atualizada" : "Categoria adicionada");
    } catch (e) {
      setErroModal(
        tratarErro(e, {
          contexto: "salvar categoria",
          mensagemUsuario: "Não foi possível salvar a categoria.",
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
      await excluirCategoria(editando.id);
      await carregar();
      setModalAberto(false);
      setEditando(null);
      setConfirmandoExclusao(false);
      toast.sucesso("Categoria excluída");
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir categoria",
        mensagemUsuario: "Não foi possível excluir a categoria.",
      });
    } finally {
      setExcluindo(false);
    }
  }

  // ── Derivados ──────────────────────────────────────────────────────────────

  const usadasEsteMes = categorias.filter((c) => c.usadaEsteMes).length;

  const categoriasExibidas = categorias.filter((c) => {
    if (filtro === "entrada" && c.type !== "INCOME") return false;
    if (filtro === "saida" && c.type !== "EXPENSE") return false;
    if (busca.trim()) return c.name.toLowerCase().includes(busca.toLowerCase());
    return true;
  });

  const GRID = "minmax(0,1fr) 100px 100px 130px 44px";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">categorias criadas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : categorias.length}
          </p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">usadas este mês</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : usadasEsteMes}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 w-60 h-10 px-3.5 bg-surface border border-border rounded-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar categoria…"
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
          />
        </div>
        {(["todas", "entrada", "saida"] as Filtro[]).map((f) => {
          const ativo = filtro === f;
          const label = f === "todas" ? "Todas" : f === "entrada" ? "Entrada" : "Saída";
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

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center" style={{ gridTemplateColumns: GRID }}>
          <span className="text-xs font-semibold text-ink-muted">Categoria</span>
          <span className="text-xs font-semibold text-ink-muted">Cor</span>
          <span className="text-xs font-semibold text-ink-muted">Tipo</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Lançamentos</span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : categoriasExibidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-1">
            <p className="text-sm font-medium text-ink-muted">
              {busca || filtro !== "todas"
                ? "Nenhuma categoria encontrada para este filtro."
                : "Nenhuma categoria cadastrada ainda."}
            </p>
            {!busca && filtro === "todas" && (
              <p className="text-xs text-ink-placeholder">
                Clique em "Adicionar" para criar sua primeira categoria.
              </p>
            )}
          </div>
        ) : (
          categoriasExibidas.map((c, i) => (
            <div key={c.id}>
              <div className="grid px-5 items-center group" style={{ gridTemplateColumns: GRID, minHeight: "56px" }}>
                {/* Categoria */}
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.color}1A`, color: c.color }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
                    </svg>
                  </span>
                  <p className="text-[14px] font-semibold text-ink truncate">{c.name}</p>
                </div>

                {/* Cor */}
                <div>
                  <span className="w-5 h-5 rounded-full inline-block" style={{ background: c.color }} />
                </div>

                {/* Tipo */}
                <div>
                  <span
                    className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[12px] font-semibold"
                    style={{
                      background: c.type === "INCOME" ? "#E2F4EC" : "#FBE9E7",
                      color: c.type === "INCOME" ? "#0B6E4A" : "#9B2C2C",
                    }}
                  >
                    {c.type === "INCOME" ? "Entrada" : "Saída"}
                  </span>
                </div>

                {/* Lançamentos */}
                <div className="text-right">
                  <span className="text-[14px] font-semibold text-ink tabular-nums">
                    {c.lancamentos > 0 ? c.lancamentos : "—"}
                  </span>
                </div>

                {/* Editar */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => abrirModalEditar(c)}
                    aria-label="Editar categoria"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              </div>
              {i < categoriasExibidas.length - 1 && <div className="h-px bg-border-subtle mx-5" />}
            </div>
          ))
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
            className="w-[480px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
            style={{ padding: "30px 30px 26px", maxHeight: "calc(100vh - 48px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmandoExclusao ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[21px] font-bold text-ink tracking-tight">Excluir categoria</p>
                  <button
                    onClick={() => setConfirmandoExclusao(false)}
                    aria-label="Voltar"
                    className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ background: "#F0F2F6", color: "#5B616E" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                <div className="rounded-2xl p-4 mb-6" style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}>
                  <p className="text-[14px] font-semibold text-[#991B1B]">Isso não pode ser desfeito</p>
                  <p className="text-[13px] text-[#7F1D1D] mt-1">
                    A categoria <strong>{editando?.name}</strong> será removida. Lançamentos
                    que a usam ficam sem categoria, mas não são apagados.
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
                    {editando ? "Editar categoria" : "Nova categoria"}
                  </p>
                  <button
                    onClick={fecharModal}
                    disabled={salvando}
                    aria-label="Fechar"
                    className="w-[34px] h-[34px] rounded-full border-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
                    style={{ background: "#F0F2F6", color: "#5B616E" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>

                {/* Nome */}
                <label className="block mb-4">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Nome da categoria</span>
                  <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && nome.trim() && salvar()}
                      placeholder="Ex: Mercado, Salário, Lazer…"
                      autoFocus
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>

                {/* Tipo */}
                <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">Tipo</p>
                <div className="flex gap-2 mb-5">
                  {([
                    { id: "EXPENSE", label: "Saída (despesa)" },
                    { id: "INCOME", label: "Entrada (receita)" },
                  ] as { id: TipoCategoria; label: string }[]).map((t) => {
                    const ativo = tipo === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTipo(t.id)}
                        className="flex-1 h-10 rounded-full font-semibold text-[14px] transition-colors"
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
                <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">Cor</p>
                <div className="flex items-center justify-between mb-6">
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
                    disabled={!nome.trim() || salvando}
                    className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: "#4078E6", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
                  >
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar categoria"}
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
