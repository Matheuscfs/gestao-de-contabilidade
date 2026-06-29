import { useState, useEffect, useCallback, useRef } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { usePerfilStore } from "@/app/perfil-store";
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

/** Redimensiona e converte a imagem escolhida em data URL base64 (mesmo fluxo do onboarding). */
function redimensionarParaBase64(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas não disponível"));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = objectUrl;
  });
}

function inicial(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() || "?";
}

// ─── Chips de relacionamento (pré-preenchem a descrição) ─────────────────────

const RELACIONAMENTOS = [
  { label: "Parceiro(a)", descricao: "parceiro(a) · divide a casa" },
  { label: "Filho(a)", descricao: "filho(a)" },
  { label: "Pai ou mãe", descricao: "pai / mãe · você ajuda" },
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

  const iconeProps = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const vinculos = [
    {
      label: "contas",
      count: persona.contasCount,
      titulo: `${persona.contasCount} conta(s) vinculada(s)`,
      icone: (
        <svg {...iconeProps}>
          <line x1="3" x2="21" y1="22" y2="22" />
          <line x1="6" x2="6" y1="18" y2="11" />
          <line x1="10" x2="10" y1="18" y2="11" />
          <line x1="14" x2="14" y1="18" y2="11" />
          <line x1="18" x2="18" y1="18" y2="11" />
          <polygon points="12 2 20 7 4 7" />
        </svg>
      ),
    },
    {
      label: "cartoes",
      count: persona.cartoesCount,
      titulo: `${persona.cartoesCount} cartão(ões) vinculado(s)`,
      icone: (
        <svg {...iconeProps}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ),
    },
    {
      label: "lancamentos",
      count: persona.lancamentosCount,
      titulo: `${persona.lancamentosCount} lançamento(s) vinculado(s)`,
      icone: (
        <svg {...iconeProps}>
          <line x1="8" x2="21" y1="6" y2="6" />
          <line x1="8" x2="21" y1="12" y2="12" />
          <line x1="8" x2="21" y1="18" y2="18" />
          <line x1="3" x2="3.01" y1="6" y2="6" />
          <line x1="3" x2="3.01" y1="12" y2="12" />
          <line x1="3" x2="3.01" y1="18" y2="18" />
        </svg>
      ),
    },
  ].filter((v) => v.count > 0);

  return (
    <button
      onClick={onEditar}
      aria-label={`Editar ${persona.name}`}
      className="group relative bg-surface border border-border rounded-2xl p-5 pt-6 flex flex-col items-center text-center hover:border-brand/40 hover:shadow-[0_8px_24px_-12px_rgba(14,17,22,.22)] transition-all"
      style={{ borderColor: "#E3E6EC" }}
    >
      {/* Botão de opções (canto) */}
      <span
        aria-hidden
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-transparent text-ink-muted group-hover:text-ink group-hover:bg-surface-subtle flex items-center justify-center transition-colors"
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
      </span>

      {/* Avatar grande + badge de cor */}
      <div className="relative shrink-0">
        <div
          className={`w-[78px] h-[78px] flex items-center justify-center overflow-hidden font-bold text-[28px] ${
            isEmpresa ? "rounded-[20px]" : "rounded-full"
          }`}
          style={
            persona.avatar
              ? undefined
              : { background: tintDaCor(persona.color), color: persona.color }
          }
        >
          {persona.avatar ? (
            <img
              src={persona.avatar}
              alt={persona.name}
              className="w-full h-full object-cover"
            />
          ) : isEmpresa ? (
            <svg
              width="32"
              height="32"
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
        {/* Badge de cor da persona */}
        <span
          aria-hidden
          className="absolute right-0 bottom-0 w-[18px] h-[18px] rounded-full"
          style={{ background: persona.color, border: "3px solid #fff" }}
        />
      </div>

      {/* Nome + descrição */}
      <div className="flex items-center justify-center gap-1.5 mt-3.5 w-full">
        <p className="font-bold text-[16px] text-ink tracking-tight truncate">
          {persona.name}
        </p>
        {persona.isSelf && (
          <span
            className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
            style={{ background: "#EAF1FD", color: "#2F63C9" }}
          >
            VOCÊ
          </span>
        )}
      </div>
      {persona.description && (
        <p className="text-[13px] text-ink-secondary mt-0.5 w-full truncate">
          {persona.description}
        </p>
      )}

      {/* Contagem de registros vinculados */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
        {vinculos.length > 0 ? (
          vinculos.map((v) => (
            <span
              key={v.label}
              className="inline-flex items-center gap-1 h-[22px] pl-1.5 pr-2 rounded-full text-[11.5px] font-semibold bg-surface-subtle text-ink-secondary"
              title={v.titulo}
            >
              {v.icone}
              {v.count}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-ink-muted">Sem registros ainda</span>
        )}
      </div>

      {/* Sumário financeiro */}
      {sumario && (
        <>
          <div className="h-px bg-border-subtle w-full mt-4" />
          <div className="flex flex-col items-center gap-1.5 mt-3.5">
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
              className="font-bold text-[17px] tabular-nums tracking-tight"
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
    </button>
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

  const isSelf = editando?.isSelf ?? false;
  const { atualizarNome, atualizarFoto } = usePerfilStore();

  const [tipo, setTipo] = useState<Tipo>(
    editando?.icon === "briefcase" ? "empresa" : "pessoa"
  );
  const [nome, setNome] = useState(editando?.name ?? "");
  const [descricao, setDescricao] = useState(editando?.description ?? "");
  const [cor, setCor] = useState(editando?.color ?? CORES[0].valor);
  const [avatar, setAvatar] = useState<string | null>(editando?.avatar ?? null);

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inputFotoRef = useRef<HTMLInputElement>(null);

  async function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    try {
      const base64 = await redimensionarParaBase64(file);
      setAvatar(base64);
    } catch {
      // falha silenciosa — imagem é opcional
    }
  }

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
        // A persona principal é sempre uma pessoa.
        icon: isSelf ? "user" : tipo === "empresa" ? "briefcase" : "user",
        avatar,
      };
      if (editando) {
        await editarPersona(editando.id, dados);
        // Persona principal: nome e foto seguem o perfil (sincronia bidirecional).
        if (isSelf) {
          await atualizarNome(nome.trim());
          await atualizarFoto(avatar);
        }
        toast.sucesso(isSelf ? "Perfil atualizado" : "Persona atualizada");
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
        className="w-[480px] bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{
          padding: "24px 30px 22px",
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
              <div className="flex items-center gap-2">
                <p className="text-[21px] font-bold text-ink tracking-tight">
                  {isSelf ? "Você" : editando ? "Editar persona" : "Nova persona"}
                </p>
                {isSelf && (
                  <span
                    className="inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold"
                    style={{ background: "#EAF1FD", color: "#2F63C9" }}
                  >
                    persona principal
                  </span>
                )}
              </div>
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

            {/* Tipo: Pessoa | Empresa (a persona principal é sempre você) */}
            {!isSelf && (
              <div
                className="flex gap-1.5 p-1 rounded-full mb-4"
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
            )}

            {/* Avatar / imagem — clicável para anexar foto */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  aria-label={avatar ? "Trocar imagem" : "Adicionar imagem"}
                  className={`w-[72px] h-[72px] flex items-center justify-center overflow-hidden font-bold text-[26px] transition-transform hover:opacity-90 ${
                    tipo === "empresa" ? "rounded-2xl" : "rounded-full"
                  }`}
                  style={
                    avatar
                      ? { border: "none", padding: 0 }
                      : { background: tintDaCor(cor), color: cor, border: "none" }
                  }
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : tipo === "empresa" ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="7" rx="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  ) : (
                    inicial(nome || "?")
                  )}
                </button>
                {/* Badge de câmera */}
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  aria-label="Adicionar imagem"
                  className="absolute right-[-3px] bottom-[-3px] w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center"
                  style={{ border: "2.5px solid #fff", boxShadow: "0 4px 10px -3px rgba(64,120,230,.5)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </button>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => inputFotoRef.current?.click()}
                    className="font-semibold text-[13px] text-brand hover:underline"
                  >
                    {avatar ? "Trocar imagem" : "Adicionar imagem"}
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar(null)}
                      className="font-semibold text-[13px] text-ink-muted hover:text-ink"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <p className="text-[12px] text-ink-muted mt-1 leading-snug">
                  Anexe uma foto — fica salva junto da persona.
                </p>
              </div>

              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={selecionarFoto}
              />
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

            {/* Chips de relacionamento (só para Pessoa, exceto você) */}
            {tipo === "pessoa" && !isSelf && (
              <div className="mb-4">
                <p className="text-[13px] font-semibold text-ink-secondary mb-2">
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
                        className="h-[36px] px-3.5 rounded-full font-semibold text-[14px] transition-colors"
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
            <label className="block mb-4">
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
            <div className="flex items-center justify-between mb-5">
              {CORES.map((c) => {
                const ativo = cor === c.valor;
                return (
                  <button
                    key={c.valor}
                    aria-label={c.label}
                    onClick={() => setCor(c.valor)}
                    className="w-[30px] h-[30px] rounded-full transition-transform hover:scale-110 border-none flex items-center justify-center shrink-0"
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

            {/* Aviso: persona principal não pode ser excluída */}
            {isSelf && (
              <p className="text-[12px] text-ink-muted mb-3 -mt-1">
                Essa é a sua persona — nome e foto acompanham o seu perfil e ela
                não pode ser excluída.
              </p>
            )}

            {/* Ações */}
            <div className="flex gap-2.5">
              {editando && !isSelf ? (
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

  const pessoas = personas.filter((p) => p.icon !== "briefcase" && !p.archived);
  const empresas = personas.filter((p) => p.icon === "briefcase" && !p.archived);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "760px", margin: "0 auto", width: "100%", paddingTop: "6px" }}
    >
      {/* Header */}
      <div className="px-0.5 pb-0">
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

      {/* Estado de carregamento */}
      {carregando ? (
        <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
          Carregando…
        </div>
      ) : personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm font-medium text-ink-muted">
            Nenhuma persona cadastrada ainda.
          </p>
          <button
            onClick={abrirModalNovo}
            className="mt-1 text-sm font-semibold text-brand hover:underline"
          >
            Adicionar a primeira
          </button>
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
              <div className="grid grid-cols-3 gap-3.5">
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
              <div className="grid grid-cols-3 gap-3.5">
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
