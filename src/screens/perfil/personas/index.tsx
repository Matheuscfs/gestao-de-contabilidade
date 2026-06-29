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

// ─── Paleta de cores ──────────────────────────────────────────────────────────

const CORES: { valor: string; tint: string; label: string }[] = [
  { valor: "#4078E6", tint: "#EAF1FD", label: "Azul" },
  { valor: "#2BA89B", tint: "#E0F2F1", label: "Verde-água" },
  { valor: "#0E885A", tint: "#E2F4EC", label: "Verde" },
  { valor: "#7A9A1E", tint: "#F1F8E9", label: "Lima" },
  { valor: "#B9791C", tint: "#FCF1DF", label: "Âmbar" },
  { valor: "#C2410C", tint: "#FFF1E8", label: "Laranja" },
  { valor: "#D14343", tint: "#FBE9E7", label: "Vermelho" },
  { valor: "#C2487E", tint: "#FCE7F3", label: "Rosa" },
  { valor: "#7C4DD1", tint: "#F3E8FF", label: "Roxo" },
  { valor: "#5B6472", tint: "#F0F2F6", label: "Cinza" },
];

function tintDaCor(cor: string): string {
  return CORES.find((c) => c.valor === cor)?.tint ?? "#F0F2F6";
}

function inicial(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() || "?";
}

// ─── Chips de relacionamento (pré-preenchem a descrição) ─────────────────────

const RELACIONAMENTOS = [
  { label: "Parceiro(a)", descricao: "parceiro(a) · divide a casa" },
  { label: "Filho(a)", descricao: "filho(a)" },
  { label: "Pai ou mãe", descricao: "pai / mãe · você ajuda" },
  { label: "Você", descricao: "você · suas finanças pessoais" },
  { label: "Outro", descricao: "" },
];

// ─── Sumário financeiro do card ───────────────────────────────────────────────

type SumarioInfo = {
  chip: { bg: string; cor: string; texto: string };
  valor: string;
  corValor: string;
};

function calcularSumario(p: PersonaComTotais): SumarioInfo | null {
  if (p.receitasCents === 0 && p.despesasCents === 0) return null;

  const net = p.receitasCents - p.despesasCents;

  if (net > 0) {
    return {
      chip: { bg: "#E2F4EC", cor: "#0E885A", texto: "tá tranquilo" },
      valor: `sobra ${formatarBRL(net)}`,
      corValor: "#12A06B",
    };
  }
  if (net < 0) {
    return {
      chip: { bg: "#FBE9E7", cor: "#C0413B", texto: "atenção" },
      valor: formatarBRL(Math.abs(net)),
      corValor: "#D74A45",
    };
  }
  return {
    chip: { bg: "#F0F2F6", cor: "#5B616E", texto: "em dia" },
    valor: formatarBRL(p.despesasCents),
    corValor: "#0E1116",
  };
}

// ─── Card de persona ──────────────────────────────────────────────────────────

function CardPersona({
  persona,
  onEditar,
}: {
  persona: PersonaComTotais;
  onEditar: () => void;
}) {
  const isEmpresa = persona.icon === "briefcase";
  const sumario = calcularSumario(persona);

  return (
    <div
      className="bg-surface border border-border rounded-2xl p-[18px] flex flex-col"
      style={{ borderColor: "#E3E6EC" }}
    >
      {/* Cabeçalho do card */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`w-14 h-14 flex items-center justify-center shrink-0 font-bold text-[19px] ${
            isEmpresa ? "rounded-2xl" : "rounded-full"
          }`}
          style={{ background: tintDaCor(persona.color), color: persona.color }}
        >
          {isEmpresa ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="14" x="2" y="7" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          ) : (
            inicial(persona.name)
          )}
        </div>

        {/* Nome + descrição */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[16px] text-ink tracking-tight truncate">
            {persona.name}
          </p>
          {persona.description && (
            <p className="text-[13px] text-ink-secondary mt-0.5 truncate">
              {persona.description}
            </p>
          )}
        </div>

        {/* Botão de opções */}
        <button
          onClick={onEditar}
          aria-label="Editar persona"
          className="w-8 h-8 rounded-full border-none bg-transparent text-ink-muted hover:text-ink hover:bg-surface-subtle flex items-center justify-center transition-colors shrink-0"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>

      {/* Sumário financeiro */}
      {sumario && (
        <>
          <div className="h-px bg-border-subtle mx-0 mt-[15px]" />
          <div className="flex items-center justify-between mt-[14px]">
            <span
              className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold"
              style={{
                background: sumario.chip.bg,
                color: sumario.chip.cor,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "currentColor" }}
              />
              {sumario.chip.texto}
            </span>
            <span
              className="font-bold text-[16px] tabular-nums tracking-tight"
              style={{
                color: sumario.corValor,
                fontFeatureSettings: "'tnum' 1,'lnum' 1",
              }}
            >
              {sumario.valor}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Modal de criar / editar persona ─────────────────────────────────────────

function ModalPersona({
  editando,
  onSalvo,
  onFechar,
}: {
  editando: PersonaComTotais | null;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  type Tipo = "pessoa" | "empresa";

  const [tipo, setTipo] = useState<Tipo>(
    editando?.icon === "briefcase" ? "empresa" : "pessoa"
  );
  const [nome, setNome] = useState(editando?.name ?? "");
  const [descricao, setDescricao] = useState(editando?.description ?? "");
  const [cor, setCor] = useState(editando?.color ?? CORES[0].valor);

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome da persona.");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        name: nome.trim(),
        description: descricao.trim() || null,
        color: cor,
        icon: tipo === "empresa" ? "briefcase" : "user",
      };
      if (editando) {
        await editarPersona(editando.id, dados);
        toast.sucesso("Persona atualizada");
      } else {
        await criarPersona(dados);
        toast.sucesso("Persona adicionada");
      }
      onSalvo();
    } catch (e) {
      setErro(
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
      toast.sucesso("Persona excluída");
      onSalvo();
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir persona",
        mensagemUsuario: "Não foi possível excluir a persona.",
      });
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[80]"
      style={{ background: "rgba(14,17,22,.42)" }}
      onClick={() => !salvando && onFechar()}
    >
      <div
        className="w-[480px] bg-surface rounded-3xl shadow-2xl overflow-y-auto animate-slide-up"
        style={{
          padding: "26px 30px 24px",
          maxHeight: "calc(100vh - 48px)",
          boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Confirmação de exclusão ─────────────────────────────────────── */}
        {confirmandoExclusao ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                Excluir persona
              </p>
              <button
                onClick={() => setConfirmandoExclusao(false)}
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "#F0F2F6", color: "#5B616E" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div
              className="rounded-2xl p-4 mb-6"
              style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}
            >
              <p className="text-[14px] font-semibold text-[#991B1B]">
                Isso não pode ser desfeito
              </p>
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
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50"
                style={{ background: "#D74A45" }}
              >
                {excluindo ? "Excluindo…" : "Excluir mesmo assim"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                {editando ? "Editar persona" : "Nova persona"}
              </p>
              <button
                onClick={onFechar}
                disabled={salvando}
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "#F0F2F6", color: "#5B616E" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Tipo: Pessoa | Empresa */}
            <div
              className="flex gap-1.5 p-1 rounded-full mb-5"
              style={{ background: "#F0F2F6" }}
            >
              {(["pessoa", "empresa"] as Tipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className="flex-1 h-[38px] rounded-full font-semibold text-[14px] transition-all"
                  style={
                    tipo === t
                      ? {
                          background: "#fff",
                          color: "#0E1116",
                          boxShadow: "0 1px 2px rgba(14,17,22,.10)",
                          border: "none",
                        }
                      : {
                          background: "transparent",
                          color: "#5B616E",
                          border: "none",
                        }
                  }
                >
                  {t === "pessoa" ? "Pessoa" : "Empresa / negócio"}
                </button>
              ))}
            </div>

            {/* Preview avatar */}
            <div className="flex items-center gap-4 mb-5">
              <div
                className={`w-[72px] h-[72px] flex items-center justify-center shrink-0 font-bold text-[26px] ${
                  tipo === "empresa" ? "rounded-2xl" : "rounded-full"
                }`}
                style={{ background: tintDaCor(cor), color: cor }}
              >
                {tipo === "empresa" ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="7" rx="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                ) : (
                  inicial(nome || "?")
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink truncate">
                  {nome || (tipo === "empresa" ? "Nome da empresa" : "Nome da persona")}
                </p>
                {descricao && (
                  <p className="text-[13px] text-ink-secondary mt-0.5 truncate">
                    {descricao}
                  </p>
                )}
              </div>
            </div>

            {/* Nome */}
            <label className="block mb-4">
              <span className="block text-[13px] font-semibold text-ink-secondary mb-2">
                Qual o nome?
              </span>
              <span
                className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={{ border: "1px solid #D4D8E0" }}
              >
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nome.trim() && salvar()}
                  placeholder={
                    tipo === "empresa"
                      ? "Ex: MEI design, Empresa familiar…"
                      : "Ex: Marina, Téo, Dona Cleia…"
                  }
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                />
              </span>
            </label>

            {/* Chips de relacionamento (só para Pessoa) */}
            {tipo === "pessoa" && (
              <div className="mb-5">
                <p className="text-[13px] font-semibold text-ink-secondary mb-2.5">
                  Quem é pra você?
                </p>
                <div className="flex flex-wrap gap-2">
                  {RELACIONAMENTOS.map((r) => {
                    const ativo = descricao === r.descricao && r.descricao !== "";
                    return (
                      <button
                        key={r.label}
                        onClick={() =>
                          setDescricao(ativo ? "" : r.descricao)
                        }
                        className="h-[38px] px-4 rounded-full font-semibold text-[14px] transition-colors"
                        style={
                          ativo
                            ? {
                                border: "1px solid #87BBF8",
                                background: "#EAF1FD",
                                color: "#2F63C9",
                              }
                            : {
                                border: "1px solid #E3E6EC",
                                background: "#fff",
                                color: "#5B616E",
                              }
                        }
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Descrição (editável diretamente para empresa ou personalizável para pessoa) */}
            <label className="block mb-5">
              <span className="block text-[13px] font-semibold text-ink-secondary mb-2">
                Descrição{" "}
                <span className="font-normal text-ink-muted">(opcional)</span>
              </span>
              <span
                className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={{ border: "1px solid #D4D8E0" }}
              >
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={
                    tipo === "empresa"
                      ? "Ex: seu CNPJ, conta PJ…"
                      : "Ex: seu filho · 8 anos"
                  }
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                />
              </span>
            </label>

            {/* Cor */}
            <p className="text-[13px] font-semibold text-ink-secondary mb-2.5">
              Cor pra reconhecer
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              {CORES.map((c) => {
                const ativo = cor === c.valor;
                return (
                  <button
                    key={c.valor}
                    aria-label={c.label}
                    onClick={() => setCor(c.valor)}
                    className="w-[34px] h-[34px] rounded-full transition-transform hover:scale-110 border-none flex items-center justify-center"
                    style={{
                      background: c.valor,
                      boxShadow: ativo
                        ? `0 0 0 2px #fff, 0 0 0 4px ${c.valor}`
                        : "none",
                    }}
                  >
                    {ativo && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Erro */}
            {erro && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-[13px] font-medium"
                style={{
                  background: "#FBE9E7",
                  color: "#9B1C1C",
                  border: "1px solid #FCA5A5",
                }}
              >
                {erro}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2.5">
              {editando ? (
                <button
                  onClick={() => setConfirmandoExclusao(true)}
                  className="shrink-0 h-12 px-4 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                  style={{
                    border: "1px solid #F5C5C3",
                    background: "#FEF2F2",
                    color: "#D74A45",
                  }}
                >
                  Excluir
                </button>
              ) : (
                <button
                  onClick={onFechar}
                  disabled={salvando}
                  className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                  style={{
                    border: "1px solid #D4D8E0",
                    background: "#fff",
                    color: "#0E1116",
                  }}
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={salvar}
                disabled={!nome.trim() || salvando}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  background: "#4078E6",
                  boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
                  border: "none",
                }}
              >
                {salvando
                  ? "Salvando…"
                  : editando
                  ? "Salvar alterações"
                  : "Adicionar persona"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function PersonasScreen() {
  const [personas, setPersonas] = useState<PersonaComTotais[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<PersonaComTotais | null>(null);

  const { setOnAdicionar } = useHeaderActionsStore();

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

  const abrirModalNovo = useCallback(() => {
    setEditando(null);
    setModalAberto(true);
  }, []);

  useEffect(() => {
    setOnAdicionar(abrirModalNovo);
    return () => setOnAdicionar(null);
  }, [abrirModalNovo, setOnAdicionar]);

  function abrirModalEditar(p: PersonaComTotais) {
    setEditando(p);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditando(null);
  }

  async function handleSalvo() {
    fecharModal();
    await carregar();
  }

  // ── Derivados ─────────────────────────────────────────────────────────────

  const personasFiltradas = personas.filter((p) =>
    busca.trim() ? p.name.toLowerCase().includes(busca.toLowerCase()) : true
  );

  const pessoas = personasFiltradas.filter((p) => p.icon !== "briefcase" && !p.archived);
  const empresas = personasFiltradas.filter((p) => p.icon === "briefcase" && !p.archived);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "760px", margin: "0 auto", width: "100%", paddingTop: "6px" }}
    >
      {/* Header */}
      <div className="flex items-end justify-between px-0.5 pb-0">
        <div>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "24px",
              letterSpacing: "-0.02em",
              color: "#0E1116",
            }}
          >
            Quem entra nas suas contas
          </h1>
          <p
            style={{
              fontWeight: 500,
              fontSize: "15px",
              color: "#5B616E",
              marginTop: "6px",
            }}
          >
            Você no centro — e de quem é cada gasto. Pessoas e negócios, cada um com sua urgência.
          </p>
        </div>
        <button
          onClick={abrirModalNovo}
          className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-full border border-border bg-surface text-ink font-semibold text-[14px] hover:bg-surface-subtle transition-colors shrink-0 ml-4"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
          </svg>
          Adicionar
        </button>
      </div>

      {/* Busca */}
      <div className="mt-5 mb-1">
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
            placeholder="Buscar persona…"
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
          />
        </div>
      </div>

      {/* Estado de carregamento */}
      {carregando ? (
        <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
          Carregando…
        </div>
      ) : personasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm font-medium text-ink-muted">
            {busca
              ? "Nenhuma persona encontrada."
              : "Nenhuma persona cadastrada ainda."}
          </p>
          {!busca && (
            <button
              onClick={abrirModalNovo}
              className="mt-1 text-sm font-semibold text-brand hover:underline"
            >
              Adicionar a primeira
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Seção: Pessoas */}
          {pessoas.length > 0 && (
            <>
              {empresas.length > 0 && (
                <div className="flex items-center gap-3 mt-6 mb-3 px-0.5">
                  <span className="text-[13px] font-semibold text-ink-muted">Pessoas</span>
                  <span className="flex-1 h-px bg-border-subtle" />
                </div>
              )}
              {!empresas.length && <div className="mt-5" />}
              <div className="grid grid-cols-2 gap-3.5">
                {pessoas.map((p) => (
                  <CardPersona
                    key={p.id}
                    persona={p}
                    onEditar={() => abrirModalEditar(p)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Seção: Negócios */}
          {empresas.length > 0 && (
            <>
              <div className="flex items-center gap-3 mt-6 mb-3 px-0.5">
                <span className="text-[13px] font-semibold text-ink-muted">Negócios</span>
                <span className="flex-1 h-px bg-border-subtle" />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {empresas.map((p) => (
                  <CardPersona
                    key={p.id}
                    persona={p}
                    onEditar={() => abrirModalEditar(p)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="h-6" />
        </>
      )}

      {/* Modal */}
      {modalAberto && (
        <ModalPersona
          editando={editando}
          onSalvo={handleSalvo}
          onFechar={fecharModal}
        />
      )}
    </div>
  );
}
