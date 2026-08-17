/**
 * Painel "contar pra IA" — você descreve o que já fez, o app marca no quadro.
 *
 * O fluxo é deliberadamente de duas etapas: a IA **interpreta** e mostra o que
 * entendeu; quem aplica é você, num clique. O modelo nunca escreve no banco —
 * ele só resolve "o Simples da Latance" para um card real. Ids que não existem
 * no quadro são descartados por `interpretarResposta` antes de chegar aqui.
 */

import { useState } from "react";
import { tratarErro } from "@/core/errors";
import { aiInterpretarKanban } from "@/core/ipc/ai";
import {
  descreverAcao,
  interpretarResposta,
  montarCatalogoTarefas,
  type AcaoResolvida,
} from "@/core/ia/comando-kanban";
import { alternarEtapaCard, concluirCard, type CardKanban } from "@/core/db/kanban";

const EXEMPLOS = [
  "Já fiz o Simples da Latance e da AG Tenis",
  "Emiti o pró-labore da Ronei Hirt",
  "Mandei as guias do DAS pra todo mundo do Cascavel",
  "Transmiti o SPED Contábil da Integração",
];

export function PainelIA({
  cards,
  onFechar,
  onAplicado,
}: {
  cards: CardKanban[];
  onFechar: () => void;
  onAplicado: (quantas: number) => void | Promise<void>;
}) {
  const [frase, setFrase] = useState("");
  const [pensando, setPensando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [acoes, setAcoes] = useState<AcaoResolvida[] | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [duvida, setDuvida] = useState<string | null>(null);
  const [descartadas, setDescartadas] = useState<string[]>([]);

  const abertos = cards.filter((c) => c.coluna !== "CONCLUIDO").length;

  async function interpretar() {
    if (!frase.trim()) return;
    setErro(null);
    setPensando(true);
    setAcoes(null);
    setDuvida(null);
    setDescartadas([]);
    try {
      const bruto = await aiInterpretarKanban(
        frase.trim(),
        montarCatalogoTarefas(cards)
      );
      const r = interpretarResposta(bruto, cards);
      setAcoes(r.acoes);
      setSelecionadas(new Set(r.acoes.map((_, i) => i)));
      setDuvida(r.duvida);
      setDescartadas(r.descartadas);
    } catch (e) {
      setErro(
        tratarErro(e, {
          contexto: "interpretar comando do Kanban",
          mensagemUsuario:
            "Não foi possível falar com a IA. Confira a configuração em Perfil → Integrações → IA.",
        })
      );
    } finally {
      setPensando(false);
    }
  }

  async function aplicar() {
    if (!acoes) return;
    const escolhidas = acoes.filter((_, i) => selecionadas.has(i));
    if (escolhidas.length === 0) return;

    setAplicando(true);
    try {
      for (const acao of escolhidas) {
        if (acao.etapa) {
          await alternarEtapaCard(acao.etapa.id, true);
        } else {
          await concluirCard(acao.card.id);
        }
      }
      await onAplicado(escolhidas.length);
      onFechar();
    } catch (e) {
      setErro(
        tratarErro(e, {
          contexto: "aplicar marcações do Kanban",
          mensagemUsuario: "Não foi possível marcar os itens.",
        })
      );
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[80]"
      style={{ background: "rgba(14,17,22,.42)" }}
      onClick={() => !pensando && !aplicando && onFechar()}
    >
      <div
        className="w-[560px] max-h-[86vh] overflow-y-auto bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{ padding: "24px 30px 22px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[21px] font-bold text-ink tracking-tight">
            Conta pra IA o que você já fez
          </p>
          <button
            onClick={onFechar}
            disabled={pensando || aplicando}
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ background: "#F0F2F6", color: "#5B616E" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <p className="text-[13px] text-ink-secondary mb-4">
          Escreva do seu jeito. A IA identifica o que marcar entre as{" "}
          {abertos} tarefa{abertos === 1 ? "" : "s"} em aberto e mostra aqui —
          nada é marcado sem você confirmar.
        </p>

        <textarea
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) interpretar();
          }}
          placeholder="Ex: já fiz o Simples da Latance e mandei a guia pro cliente"
          autoFocus
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans resize-none outline-none focus:border-brand transition-colors"
          style={{ border: "1px solid #D4D8E0", background: "#fff" }}
        />

        {acoes === null && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {EXEMPLOS.map((ex) => (
              <button
                key={ex}
                onClick={() => setFrase(ex)}
                className="h-[28px] px-2.5 rounded-full text-[12px] font-medium transition-colors hover:opacity-80"
                style={{ background: "#F0F2F6", color: "#5B616E" }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Resultado da interpretação */}
        {acoes !== null && (
          <div className="mt-4">
            {acoes.length > 0 && (
              <>
                <p className="text-[13px] font-semibold text-ink-secondary mb-2">
                  A IA entendeu isto — confira antes de aplicar:
                </p>
                <div className="flex flex-col gap-1.5">
                  {acoes.map((acao, i) => {
                    const marcada = selecionadas.has(i);
                    return (
                      <button
                        key={`${acao.card.id}-${acao.etapa?.id ?? "tudo"}`}
                        onClick={() =>
                          setSelecionadas((s) => {
                            const novo = new Set(s);
                            if (novo.has(i)) novo.delete(i);
                            else novo.add(i);
                            return novo;
                          })
                        }
                        className="flex items-start gap-2.5 text-left rounded-xl px-3 py-2.5 transition-colors"
                        style={{
                          border: marcada ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                          background: marcada ? "#F5F9FF" : "#fff",
                        }}
                      >
                        <span
                          className="shrink-0 mt-[1px] w-[17px] h-[17px] rounded-[5px] flex items-center justify-center"
                          style={
                            marcada
                              ? { background: "#4078E6", border: "1px solid #4078E6" }
                              : { background: "#fff", border: "1px solid #D4D8E0" }
                          }
                        >
                          {marcada && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m5 12 5 5L20 7" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-semibold text-ink leading-snug">
                            {descreverAcao(acao)}
                          </span>
                          {acao.motivo && (
                            <span className="block text-[12px] text-ink-muted mt-0.5">
                              {acao.motivo}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {duvida && (
              <div
                className="rounded-xl px-4 py-3 mt-2.5 text-[13px] font-medium"
                style={{ background: "#FCF7EC", color: "#8A6115", border: "1px solid #F0D9A8" }}
              >
                {duvida}
              </div>
            )}

            {descartadas.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[12px] font-semibold text-ink-muted mb-1">
                  Ignorado (não bate com o quadro):
                </p>
                <ul className="flex flex-col gap-0.5">
                  {descartadas.map((d) => (
                    <li key={d} className="text-[12px] text-ink-muted">
                      • {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {acoes.length === 0 && !duvida && descartadas.length === 0 && (
              <p className="text-[13px] text-ink-muted">
                A IA não encontrou nada no quadro que case com essa frase.
              </p>
            )}
          </div>
        )}

        {erro && (
          <div
            className="rounded-xl px-4 py-3 mt-4 text-[13px] font-medium"
            style={{ background: "#FBE9E7", color: "#9B1C1C", border: "1px solid #FCA5A5" }}
          >
            {erro}
          </div>
        )}

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={interpretar}
            disabled={!frase.trim() || pensando || aplicando}
            className="h-12 px-5 rounded-full font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
          >
            {pensando ? "Lendo…" : acoes === null ? "Interpretar" : "Interpretar de novo"}
          </button>
          <button
            onClick={aplicar}
            disabled={
              aplicando || pensando || !acoes || selecionadas.size === 0
            }
            className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{
              background: "#4078E6",
              boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
              border: "none",
            }}
          >
            {aplicando
              ? "Marcando…"
              : selecionadas.size > 0
              ? `Marcar ${selecionadas.size} item${selecionadas.size > 1 ? "s" : ""}`
              : "Marcar"}
          </button>
        </div>
      </div>
    </div>
  );
}
