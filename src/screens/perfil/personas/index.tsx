import { useState, useEffect, useCallback } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { formatarBRL } from "@/utils/money";
import {
  listarPersonas,
  criarPersona,
  editarPersona,
  excluirPersona,
  type PersonaComTotais,
} from "@/core/db/personas";

// ─── Constantes ───────────────────────────────────────────────────────────────

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

function inicial(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() || "?";
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function PersonasScreen() {
  const [personas, setPersonas] = useState<PersonaComTotais[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<PersonaComTotais | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Campos
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0].valor);

  const { setOnAdicionar } = useHeaderActionsStore();

  // ── Carregamento ─────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await listarPersonas();
      setPersonas(lista);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar personas",
        mensagemUsuario: "Não foi possível carregar as personas.",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Modal ──────────────────────────────────────────────────────────────────

  const abrirModalNovo = useCallback(() => {
    setEditando(null);
    setNome("");
    setDescricao("");
    setCor(CORES[0].valor);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }, []);

  function abrirModalEditar(p: PersonaComTotais) {
    setEditando(p);
    setNome(p.name);
    setDescricao(p.description ?? "");
    setCor(p.color);
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
      setErroModal("Informe o nome da persona.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        name: nome.trim(),
        description: descricao.trim() || null,
        color: cor,
        icon: "user",
      };
      if (editando) {
        await editarPersona(editando.id, dados);
      } else {
        await criarPersona(dados);
      }
      await carregar();
      setModalAberto(false);
      setEditando(null);
      toast.sucesso(editando ? "Persona atualizada" : "Persona adicionada");
    } catch (e) {
      setErroModal(
        tratarErro(e, {
          contexto: "salvar persona",
          mensagemUsuario: "Não foi possível salvar a persona.",
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
      await excluirPersona(editando.id);
      await carregar();
      setModalAberto(false);
      setEditando(null);
      setConfirmandoExclusao(false);
      toast.sucesso("Persona excluída");
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir persona",
        mensagemUsuario: "Não foi possível excluir a persona.",
      });
    } finally {
      setExcluindo(false);
    }
  }

  // ── Derivados ──────────────────────────────────────────────────────────────

  const ativas = personas.filter((p) => !p.archived).length;
  const totalReceitas = personas.reduce((s, p) => s + p.receitasCents, 0);
  const totalDespesas = personas.reduce((s, p) => s + p.despesasCents, 0);

  const personasExibidas = personas.filter((p) =>
    busca.trim() ? p.name.toLowerCase().includes(busca.toLowerCase()) : true
  );

  const GRID = "minmax(0,1fr) 150px 150px 44px";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">personas ativas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : ativas}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">receitas atribuídas</p>
          <p className="text-[22px] font-bold text-positive tabular-nums mt-1">
            {carregando || totalReceitas <= 0 ? "R$ —" : formatarBRL(totalReceitas)}
          </p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">despesas atribuídas</p>
          <p className="text-[22px] font-bold text-negative tabular-nums mt-1">
            {carregando || totalDespesas <= 0 ? "R$ —" : formatarBRL(totalDespesas)}
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
            placeholder="Buscar persona…"
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center" style={{ gridTemplateColumns: GRID }}>
          <span className="text-xs font-semibold text-ink-muted">Persona</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Receitas</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Despesas</span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : personasExibidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-1">
            <p className="text-sm font-medium text-ink-muted">
              {busca ? "Nenhuma persona encontrada." : "Nenhuma persona cadastrada ainda."}
            </p>
            {!busca && (
              <p className="text-xs text-ink-placeholder">
                Clique em "Adicionar" para criar uma persona.
              </p>
            )}
          </div>
        ) : (
          personasExibidas.map((p, i) => (
            <div key={p.id}>
              <div className="grid px-5 items-center group" style={{ gridTemplateColumns: GRID, minHeight: "60px" }}>
                {/* Persona */}
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold"
                    style={{ background: tintDaCor(p.color), color: p.color }}
                  >
                    {inicial(p.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-[12px] text-ink-muted truncate">{p.description}</p>
                    )}
                  </div>
                </div>

                {/* Receitas */}
                <div className="text-right">
                  <span className="text-[14px] font-semibold tabular-nums" style={{ color: p.receitasCents > 0 ? "#0B6E4A" : "#8C95A6" }}>
                    {p.receitasCents > 0 ? formatarBRL(p.receitasCents) : "—"}
                  </span>
                </div>

                {/* Despesas */}
                <div className="text-right">
                  <span className="text-[14px] font-semibold tabular-nums" style={{ color: p.despesasCents > 0 ? "#9B2C2C" : "#8C95A6" }}>
                    {p.despesasCents > 0 ? formatarBRL(p.despesasCents) : "—"}
                  </span>
                </div>

                {/* Editar */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => abrirModalEditar(p)}
                    aria-label="Editar persona"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              </div>
              {i < personasExibidas.length - 1 && <div className="h-px bg-border-subtle mx-5" />}
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
                  <p className="text-[21px] font-bold text-ink tracking-tight">Excluir persona</p>
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
                    A persona <strong>{editando?.name}</strong> será removida. Lançamentos e
                    contas vinculados a ela ficam sem persona, mas não são apagados.
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
                    {editando ? "Editar persona" : "Nova persona"}
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

                {/* Preview avatar */}
                <div className="flex items-center gap-3 mb-5">
                  <span
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-[18px] font-bold"
                    style={{ background: tintDaCor(cor), color: cor }}
                  >
                    {inicial(nome || "?")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink truncate">{nome || "Nome da persona"}</p>
                    {descricao && <p className="text-[12px] text-ink-muted truncate">{descricao}</p>}
                  </div>
                </div>

                {/* Nome */}
                <label className="block mb-4">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Nome</span>
                  <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && nome.trim() && salvar()}
                      placeholder="Ex: Pessoal, Empresa, Família…"
                      autoFocus
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>

                {/* Descrição */}
                <label className="block mb-5">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                    Descrição <span className="font-normal text-ink-muted">(opcional)</span>
                  </span>
                  <span className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors" style={{ border: "1px solid #D4D8E0" }}>
                    <input
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex: Finanças do trabalho"
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>

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
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar persona"}
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
