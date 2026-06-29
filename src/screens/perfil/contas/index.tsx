import { useState, useEffect, useCallback, useMemo } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { formatarBRL } from "@/utils/money";
import { ContaAvatar } from "@/components/conta-avatar";
import { SeletorBanco } from "@/components/seletor-banco";
import { reconhecerBanco, buscarBancos, bancoPorNome } from "@/consts/banks";
import {
  listarContas,
  criarConta,
  editarConta,
  excluirConta,
  type Conta,
  type TipoConta,
} from "@/core/db/contas";

// ─── Tipos de conta ───────────────────────────────────────────────────────────

const TIPOS: { id: TipoConta; label: string }[] = [
  { id: "CHECKING", label: "Corrente" },
  { id: "SAVINGS", label: "Poupança" },
  { id: "INVESTMENT", label: "Investimentos" },
  { id: "OTHER", label: "Outros" },
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

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function ContasScreen() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Campos do modal
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoConta>("CHECKING");
  const [cor, setCor] = useState(CORES[0].valor);
  // Banco vinculado (nome em consts/banks) ou null = ícone genérico.
  const [banco, setBanco] = useState<string | null>(null);
  // Usuário escolheu o banco manualmente → para de auto-reconhecer pelo nome.
  const [bancoTocado, setBancoTocado] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);
  // Saldo é preservado na edição, mas não é mais editável aqui (contas novas começam em 0).
  const [saldoCentavos, setSaldoCentavos] = useState(0);

  // Bancos alternativos enquanto digita (exclui o que já foi auto-reconhecido).
  const sugestoes = useMemo(() => {
    if (bancoTocado) return [];
    return buscarBancos(nome, 5).filter((b) => b.name !== banco).slice(0, 4);
  }, [nome, banco, bancoTocado]);

  const { setOnAdicionar } = useHeaderActionsStore();

  const totalCentavos = contas.reduce((soma, c) => soma + c.balanceCents, 0);

  // ── Carregamento ─────────────────────────────────────────────────────────────

  const carregarContas = useCallback(async () => {
    try {
      const lista = await listarContas();
      setContas(lista);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar contas",
        mensagemUsuario: "Não foi possível carregar as contas.",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

  // ── Modal ──────────────────────────────────────────────────────────────────

  const abrirModalNovo = useCallback(() => {
    setEditando(null);
    setNome("");
    setTipo("CHECKING");
    setCor(CORES[0].valor);
    setBanco(null);
    setBancoTocado(false);
    setIsPrimary(contas.length === 0); // sugere primária se for a primeira
    setSaldoCentavos(0);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }, [contas.length]);

  function abrirModalEditar(conta: Conta) {
    setEditando(conta);
    setNome(conta.name);
    setTipo(conta.type);
    setCor(conta.color);
    setBanco(bancoPorNome(conta.icon)?.name ?? null);
    setBancoTocado(true); // não auto-reconhece por cima de uma conta existente
    setIsPrimary(conta.isPrimary);
    setSaldoCentavos(conta.balanceCents);
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }

  // Auto-reconhece o banco enquanto o usuário digita (até escolher manualmente).
  function handleChangeNome(valor: string) {
    setNome(valor);
    if (!bancoTocado) {
      setBanco(reconhecerBanco(valor)?.name ?? null);
    }
  }

  function escolherBanco(nomeBanco: string | null) {
    setBanco(nomeBanco);
    setBancoTocado(true);
  }

  useEffect(() => {
    setOnAdicionar(abrirModalNovo);
    return () => setOnAdicionar(null);
  }, [abrirModalNovo, setOnAdicionar]);

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
    setConfirmandoExclusao(false);
    setErroModal(null);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function salvar() {
    setErroModal(null);
    if (!nome.trim()) {
      setErroModal("Dê um nome para a conta.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        name: nome.trim(),
        type: tipo,
        color: cor,
        icon: banco ?? "",
        isPrimary,
        balanceCents: saldoCentavos,
      };
      if (editando) {
        await editarConta(editando.id, dados);
      } else {
        await criarConta(dados);
      }
      await carregarContas();
      setModalAberto(false);
      setEditando(null);
      toast.sucesso(editando ? "Conta atualizada" : "Conta adicionada");
    } catch (e) {
      setErroModal(
        tratarErro(e, {
          contexto: "salvar conta",
          mensagemUsuario: "Não foi possível salvar a conta.",
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
      await excluirConta(editando.id);
      await carregarContas();
      setModalAberto(false);
      setEditando(null);
      setConfirmandoExclusao(false);
      toast.sucesso("Conta excluída");
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir conta",
        mensagemUsuario: "Não foi possível excluir a conta.",
      });
    } finally {
      setExcluindo(false);
    }
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
            {carregando ? "R$ —" : contas.length > 0 ? formatarBRL(totalCentavos) : "R$ —"}
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
          {carregando ? (
            <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
              Carregando…
            </div>
          ) : contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-1">
              <p className="text-sm font-medium text-ink-muted">
                Nenhuma conta cadastrada ainda.
              </p>
              <p className="text-xs text-ink-placeholder">
                Clique em "Adicionar" para cadastrar sua primeira conta.
              </p>
            </div>
          ) : (
            contas.map((conta, i) => (
              <div key={conta.id}>
                <button
                  onClick={() => abrirModalEditar(conta)}
                  className="w-full flex items-center gap-[14px] px-5 py-[18px] text-left hover:bg-surface-subtle transition-colors"
                >
                  <ContaAvatar icon={conta.icon} cor={conta.color} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-semibold text-ink">{conta.name}</p>
                      {conta.isPrimary && (
                        <span
                          aria-label="Conta principal"
                          title="Conta principal"
                          className="inline-flex items-center text-[#E8A020] shrink-0"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                            <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.77l-5.8 3.07 1.1-6.46-4.69-4.58 6.49-.94z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] font-medium text-[#5B616E] mt-0.5">
                      {tipoLabel(conta.type)}
                    </p>
                  </div>
                  <p className="text-[17px] font-semibold text-ink tabular-nums">
                    {formatarBRL(conta.balanceCents)}
                  </p>
                </button>
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
            {confirmandoExclusao ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[21px] font-bold text-ink tracking-tight">Excluir conta</p>
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
                    A conta <strong>{editando?.name}</strong> será removida. Seus lançamentos
                    deixam de estar vinculados a ela, mas não são apagados.
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
                {/* Header */}
                <div className="flex items-center justify-between mb-[22px]">
                  <p className="text-[21px] font-bold text-ink tracking-tight">
                    {editando ? "Editar conta" : "Nova conta"}
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
                <div className="mb-4">
                  <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
                    Como você chama ela?
                  </span>
                  <span
                    className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                    style={{ border: "1px solid #D4D8E0" }}
                  >
                    <input
                      value={nome}
                      onChange={(e) => handleChangeNome(e.target.value)}
                      placeholder="Ex: Nubank"
                      autoFocus
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>

                  {/* Sugestões de banco reconhecido enquanto digita */}
                  {sugestoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sugestoes.map((b) => (
                        <button
                          key={b.name}
                          onClick={() => escolherBanco(b.name)}
                          className="inline-flex items-center gap-1.5 h-8 pl-1.5 pr-3 rounded-full bg-surface-subtle hover:bg-border-subtle transition-colors"
                          style={{ border: "1px solid #E3E6EC" }}
                        >
                          <span className="w-[22px] h-[22px] rounded-full bg-white flex items-center justify-center overflow-hidden p-0.5" style={{ border: "1px solid #E3E6EC" }}>
                            <img src={b.icon} alt={b.name} className="w-full h-full object-contain" />
                          </span>
                          <span className="text-[13px] font-semibold text-ink">{b.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Banco vinculado */}
                <p className="text-[13px] font-semibold text-[#5B616E] mb-2">Banco</p>
                <div className="mb-5">
                  <SeletorBanco value={banco} onChange={escolherBanco} />
                </div>

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
                        onClick={() => setTipo(t.id)}
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
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[13px] font-semibold text-[#5B616E]">
                    Cor {banco ? "(bandeira)" : ""}
                  </p>
                  <ContaAvatar icon={banco ?? ""} cor={cor} size={28} />
                </div>
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

                <div className="mb-6" />

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
                      className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={salvar}
                    disabled={!nome.trim() || salvando}
                    className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    style={{ background: "#4078E6", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
                  >
                    {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar"}
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
