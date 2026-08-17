/**
 * Aba Processos — trabalhos administrativos da empresa com prazo e checklist
 * (abertura, alteração contratual, parcelamento, certidões, defesa, baixa…).
 */

import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  adicionarEtapa,
  alternarEtapa,
  atualizarStatusProcesso,
  criarProcesso,
  editarProcesso,
  excluirEtapa,
  excluirProcesso,
  ETAPAS_SUGERIDAS,
  LABEL_STATUS_PROCESSO,
  LABEL_TIPO_PROCESSO,
  type DadosProcesso,
  type Processo,
  type TipoProcesso,
} from "@/core/db/processos";
import { formatarData } from "@/utils/dates";

const ESTILO_BORDA = { border: "1px solid #D4D8E0" };
const TIPOS: TipoProcesso[] = [
  "ABERTURA",
  "ALTERACAO",
  "PARCELAMENTO",
  "CERTIDAO",
  "DEFESA",
  "REGULARIZACAO",
  "BAIXA",
  "OUTRO",
];

async function copiarProtocolo(protocolo: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(protocolo);
    toast.sucesso("Protocolo copiado");
  } catch (e) {
    tratarErro(e, {
      contexto: "copiar protocolo",
      mensagemUsuario: "Não foi possível copiar o protocolo.",
    });
  }
}

async function abrirLink(link: string): Promise<void> {
  try {
    await open(link);
  } catch (e) {
    tratarErro(e, {
      contexto: "abrir acompanhamento do processo",
      mensagemUsuario: "Não foi possível abrir o link no navegador.",
    });
  }
}

const CHIP_STATUS: Record<string, { bg: string; cor: string }> = {
  EM_ANDAMENTO: { bg: "#EAF1FD", cor: "#2F63C9" },
  AGUARDANDO: { bg: "#FCF1DF", cor: "#B9791C" },
  CONCLUIDO: { bg: "#E2F4EC", cor: "#0E885A" },
  CANCELADO: { bg: "#F0F2F6", cor: "#5B616E" },
};

// ─── Modal criar/editar processo ──────────────────────────────────────────────

function ModalProcesso({
  empresaId,
  editando,
  onSalvo,
  onFechar,
}: {
  empresaId: string;
  editando: Processo | null;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoProcesso>(editando?.tipo ?? "ABERTURA");
  const [prazo, setPrazo] = useState(editando?.prazo ?? "");
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [protocolo, setProtocolo] = useState(editando?.protocolo ?? "");
  const [link, setLink] = useState(editando?.link ?? "");
  // Checklist inicial (só na criação; na edição as etapas são geridas no card).
  const [etapas, setEtapas] = useState<string[]>(
    editando ? [] : ETAPAS_SUGERIDAS.ABERTURA
  );
  const [etapasEditadas, setEtapasEditadas] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function selecionarTipo(t: TipoProcesso) {
    setTipo(t);
    // Se o usuário ainda não mexeu no checklist, acompanha a sugestão do tipo.
    if (!editando && !etapasEditadas) setEtapas(ETAPAS_SUGERIDAS[t]);
  }

  async function salvar() {
    setErro(null);
    if (!titulo.trim()) {
      setErro("Dê um título ao processo.");
      return;
    }
    setSalvando(true);
    try {
      const dados: DadosProcesso = {
        titulo,
        tipo,
        descricao: descricao || null,
        prazo: prazo || null,
        protocolo: protocolo || null,
        link: link || null,
      };
      if (editando) {
        await editarProcesso(editando.id, dados);
        toast.sucesso("Processo atualizado");
      } else {
        await criarProcesso(empresaId, dados, etapas);
        toast.sucesso("Processo criado");
      }
      onSalvo();
    } catch (e) {
      setErro(
        tratarErro(e, {
          contexto: "salvar processo",
          mensagemUsuario: "Não foi possível salvar o processo.",
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
      await excluirProcesso(editando.id);
      toast.sucesso("Processo excluído");
      onSalvo();
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir processo",
        mensagemUsuario: "Não foi possível excluir o processo.",
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
        className="w-[540px] max-h-[88vh] overflow-y-auto bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{ padding: "24px 30px 22px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {confirmandoExclusao ? (
          <>
            <p className="text-[21px] font-bold text-ink tracking-tight mb-6">
              Excluir processo
            </p>
            <div
              className="rounded-2xl p-4 mb-6"
              style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}
            >
              <p className="text-[14px] font-semibold text-[#991B1B]">
                Isso não pode ser desfeito
              </p>
              <p className="text-[13px] text-[#7F1D1D] mt-1">
                <strong>{editando?.titulo}</strong> e o checklist dele serão
                removidos. Se o trabalho foi encerrado, prefira marcar como
                concluído ou cancelado para manter o histórico.
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
            <div className="flex items-center justify-between mb-5">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                {editando ? "Editar processo" : "Novo processo"}
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

            <div className="flex flex-col gap-4">
              {/* Tipo */}
              <div>
                <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">Tipo</p>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map((t) => {
                    const ativo = tipo === t;
                    return (
                      <button
                        key={t}
                        onClick={() => selecionarTipo(t)}
                        className="h-[34px] px-3 rounded-full font-semibold text-[13px] transition-colors"
                        style={
                          ativo
                            ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                            : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                        }
                      >
                        {LABEL_TIPO_PROCESSO[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Título */}
              <label className="block">
                <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
                  Título
                </span>
                <span
                  className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                  style={ESTILO_BORDA}
                >
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Parcelamento do Simples 2025"
                    autoFocus={!editando}
                    className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                  />
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
                    Prazo <span className="font-normal text-ink-muted">(opcional)</span>
                  </span>
                  <span
                    className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                    style={ESTILO_BORDA}
                  >
                    <input
                      type="date"
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink font-sans"
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
                    Observações <span className="font-normal text-ink-muted">(opcional)</span>
                  </span>
                  <span
                    className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                    style={ESTILO_BORDA}
                  >
                    <input
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex: NIRE, exigência pendente…"
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
                    Protocolo <span className="font-normal text-ink-muted">(opcional)</span>
                  </span>
                  <span
                    className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                    style={ESTILO_BORDA}
                  >
                    <input
                      value={protocolo}
                      onChange={(e) => setProtocolo(e.target.value)}
                      placeholder="Ex: PRB2501149221"
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
                    Acompanhamento <span className="font-normal text-ink-muted">(opcional)</span>
                  </span>
                  <span
                    className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                    style={ESTILO_BORDA}
                  >
                    <input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://…"
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                    />
                  </span>
                </label>
              </div>

              {/* Checklist inicial (criação) */}
              {!editando && (
                <div>
                  <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">
                    Etapas{" "}
                    <span className="font-normal text-ink-muted">
                      (sugeridas pelo tipo — ajuste à vontade)
                    </span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {etapas.map((etapa, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="flex-1 flex items-center h-[40px] px-3.5 bg-surface rounded-xl focus-within:border-brand transition-colors"
                          style={ESTILO_BORDA}
                        >
                          <input
                            value={etapa}
                            onChange={(e) => {
                              setEtapasEditadas(true);
                              setEtapas(etapas.map((x, j) => (j === i ? e.target.value : x)));
                            }}
                            className="flex-1 min-w-0 border-none outline-none bg-transparent text-[13.5px] font-medium text-ink font-sans"
                          />
                        </span>
                        <button
                          onClick={() => {
                            setEtapasEditadas(true);
                            setEtapas(etapas.filter((_, j) => j !== i));
                          }}
                          aria-label="Remover etapa"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-negative hover:bg-surface-subtle transition-colors shrink-0"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        setEtapasEditadas(true);
                        setEtapas([...etapas, ""]);
                      }}
                      className="self-start text-[13px] font-semibold text-brand hover:underline mt-0.5"
                    >
                      + Adicionar etapa
                    </button>
                  </div>
                </div>
              )}
            </div>

            {erro && (
              <div
                className="rounded-xl px-4 py-3 mt-4 text-[13px] font-medium"
                style={{ background: "#FBE9E7", color: "#9B1C1C", border: "1px solid #FCA5A5" }}
              >
                {erro}
              </div>
            )}

            <div className="flex gap-2.5 mt-5">
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
                  onClick={onFechar}
                  disabled={salvando}
                  className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                  style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={salvar}
                disabled={!titulo.trim() || salvando}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  background: "#4078E6",
                  boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
                  border: "none",
                }}
              >
                {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar processo"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Card de processo ─────────────────────────────────────────────────────────

function CardProcesso({
  processo,
  onEditar,
  onMudou,
}: {
  processo: Processo;
  onEditar: () => void;
  onMudou: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState("");
  const [processando, setProcessando] = useState(false);

  const chip = CHIP_STATUS[processo.status];
  const feitas = processo.etapas.filter((e) => e.concluida).length;
  const ativo =
    processo.status === "EM_ANDAMENTO" || processo.status === "AGUARDANDO";

  async function executar(acao: () => Promise<void>, contexto: string) {
    setProcessando(true);
    try {
      await acao();
      onMudou();
    } catch (e) {
      tratarErro(e, {
        contexto,
        mensagemUsuario: "Não foi possível atualizar o processo.",
      });
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div
      className="bg-surface border rounded-2xl"
      style={{
        borderColor: processo.atrasado ? "#F5C5C3" : "#E3E6EC",
        opacity: ativo ? 1 : 0.7,
      }}
    >
      {/* Cabeçalho (clique expande) */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-[14.5px] text-ink">{processo.titulo}</p>
            <span
              className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
              style={{ background: "#F0F2F6", color: "#5B616E" }}
            >
              {LABEL_TIPO_PROCESSO[processo.tipo]}
            </span>
            <span
              className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
              style={{ background: chip.bg, color: chip.cor }}
            >
              {LABEL_STATUS_PROCESSO[processo.status]}
            </span>
            {processo.atrasado && (
              <span
                className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
                style={{ background: "#FBE9E7", color: "#C0413B" }}
              >
                ATRASADO
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-ink-secondary mt-0.5">
            {processo.etapas.length > 0 &&
              `${feitas}/${processo.etapas.length} etapas`}
            {processo.etapas.length > 0 && processo.prazo && " · "}
            {processo.prazo && `prazo ${formatarData(processo.prazo, true)}`}
            {!processo.etapas.length && !processo.prazo && "sem checklist nem prazo"}
          </p>
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 text-ink-muted transition-transform"
          style={{ transform: expandido ? "rotate(180deg)" : "none" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Corpo expandido */}
      {expandido && (
        <div className="px-5 pb-4">
          {processo.descricao && (
            <p className="text-[13px] text-ink-secondary mb-3">{processo.descricao}</p>
          )}

          {/* Protocolo e acompanhamento no órgão */}
          {(processo.protocolo || processo.link) && (
            <div className="flex items-center gap-2 mb-3 min-w-0">
              {processo.protocolo && (
                <button
                  onClick={() => copiarProtocolo(processo.protocolo!)}
                  title="Copiar protocolo"
                  className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-[12px] font-semibold tabular-nums transition-opacity hover:opacity-75 min-w-0"
                  style={{ background: "#F0F2F6", color: "#5B616E" }}
                >
                  <span className="truncate">{processo.protocolo}</span>
                </button>
              )}
              {processo.link && (
                <button
                  onClick={() => abrirLink(processo.link!)}
                  className="text-[12.5px] font-semibold text-brand hover:underline shrink-0"
                >
                  Acompanhar no órgão ↗
                </button>
              )}
            </div>
          )}

          {/* Checklist */}
          <div className="flex flex-col gap-1">
            {processo.etapas.map((etapa) => (
              <div key={etapa.id} className="group flex items-center gap-2.5">
                <button
                  onClick={() =>
                    executar(
                      () => alternarEtapa(etapa.id, !etapa.concluida),
                      "alternar etapa"
                    )
                  }
                  disabled={processando || !ativo}
                  className="flex items-center gap-2.5 flex-1 py-1.5 text-left disabled:cursor-default"
                >
                  <span
                    className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0 transition-colors"
                    style={
                      etapa.concluida
                        ? { background: "#4078E6", border: "1.5px solid #4078E6" }
                        : { background: "#fff", border: "1.5px solid #C7CCD6" }
                    }
                  >
                    {etapa.concluida && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  <span
                    className="text-[13.5px] font-medium"
                    style={{
                      color: etapa.concluida ? "#9AA0AC" : "#0E1116",
                      textDecoration: etapa.concluida ? "line-through" : "none",
                    }}
                  >
                    {etapa.descricao}
                  </span>
                </button>
                {ativo && (
                  <button
                    onClick={() =>
                      executar(() => excluirEtapa(etapa.id), "excluir etapa")
                    }
                    aria-label="Remover etapa"
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:text-negative transition-all shrink-0"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Nova etapa */}
          {ativo && (
            <div className="flex items-center gap-2 mt-2">
              <span
                className="flex-1 flex items-center h-[38px] px-3.5 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={ESTILO_BORDA}
              >
                <input
                  value={novaEtapa}
                  onChange={(e) => setNovaEtapa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novaEtapa.trim()) {
                      executar(async () => {
                        await adicionarEtapa(processo.id, novaEtapa);
                        setNovaEtapa("");
                      }, "adicionar etapa");
                    }
                  }}
                  placeholder="Nova etapa — Enter para adicionar"
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                />
              </span>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 mt-3.5">
            {ativo ? (
              <>
                <button
                  onClick={() =>
                    executar(
                      () => atualizarStatusProcesso(processo.id, "CONCLUIDO"),
                      "concluir processo"
                    )
                  }
                  disabled={processando}
                  className="h-9 px-4 rounded-full font-semibold text-[13px] text-white transition-opacity disabled:opacity-50"
                  style={{ background: "#12A06B", border: "none" }}
                >
                  Concluir
                </button>
                <button
                  onClick={() =>
                    executar(
                      () =>
                        atualizarStatusProcesso(
                          processo.id,
                          processo.status === "AGUARDANDO"
                            ? "EM_ANDAMENTO"
                            : "AGUARDANDO"
                        ),
                      "mudar status"
                    )
                  }
                  disabled={processando}
                  className="h-9 px-3.5 rounded-full font-semibold text-[13px] hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#5B616E" }}
                >
                  {processo.status === "AGUARDANDO"
                    ? "Retomar andamento"
                    : "Marcar aguardando"}
                </button>
                <button
                  onClick={onEditar}
                  className="h-9 px-3.5 rounded-full font-semibold text-[13px] hover:opacity-80 transition-opacity"
                  style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#5B616E" }}
                >
                  Editar
                </button>
                <button
                  onClick={() =>
                    executar(
                      () => atualizarStatusProcesso(processo.id, "CANCELADO"),
                      "cancelar processo"
                    )
                  }
                  disabled={processando}
                  className="ml-auto h-9 px-3 rounded-full font-semibold text-[13px] text-ink-muted hover:text-negative transition-colors disabled:opacity-50"
                >
                  Cancelar processo
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  executar(
                    () => atualizarStatusProcesso(processo.id, "EM_ANDAMENTO"),
                    "reabrir processo"
                  )
                }
                disabled={processando}
                className="h-9 px-3.5 rounded-full font-semibold text-[13px] hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#5B616E" }}
              >
                Reabrir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aba ──────────────────────────────────────────────────────────────────────

export function AbaProcessos({
  empresaId,
  processos,
  onRecarregar,
}: {
  empresaId: string;
  processos: Processo[];
  onRecarregar: () => void;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Processo | null>(null);
  const { setOnAdicionar } = useHeaderActionsStore();

  // O "Adicionar" do header cria um novo processo enquanto esta aba está ativa.
  useEffect(() => {
    setOnAdicionar(() => {
      setEditando(null);
      setModalAberto(true);
    });
    return () => setOnAdicionar(null);
  }, [setOnAdicionar]);

  const ativos = processos.filter(
    (p) => p.status === "EM_ANDAMENTO" || p.status === "AGUARDANDO"
  );
  const encerrados = processos.filter(
    (p) => p.status === "CONCLUIDO" || p.status === "CANCELADO"
  );

  return (
    <div className="flex flex-col gap-5">
      {processos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2">
          <p className="text-sm font-medium text-ink-muted">
            Nenhum processo nesta empresa.
          </p>
          <button
            onClick={() => {
              setEditando(null);
              setModalAberto(true);
            }}
            className="mt-1 text-sm font-semibold text-brand hover:underline"
          >
            Criar o primeiro
          </button>
        </div>
      ) : (
        <>
          {ativos.length > 0 && (
            <div className="flex flex-col gap-2">
              {ativos.map((p) => (
                <CardProcesso
                  key={p.id}
                  processo={p}
                  onEditar={() => {
                    setEditando(p);
                    setModalAberto(true);
                  }}
                  onMudou={onRecarregar}
                />
              ))}
            </div>
          )}
          {encerrados.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2.5 px-0.5">
                <span className="text-[13px] font-semibold text-ink-muted">
                  Encerrados
                </span>
                <span className="flex-1 h-px bg-border-subtle" />
              </div>
              <div className="flex flex-col gap-2">
                {encerrados.map((p) => (
                  <CardProcesso
                    key={p.id}
                    processo={p}
                    onEditar={() => {
                      setEditando(p);
                      setModalAberto(true);
                    }}
                    onMudou={onRecarregar}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {modalAberto && (
        <ModalProcesso
          empresaId={empresaId}
          editando={editando}
          onSalvo={() => {
            setModalAberto(false);
            setEditando(null);
            onRecarregar();
          }}
          onFechar={() => {
            setModalAberto(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}
