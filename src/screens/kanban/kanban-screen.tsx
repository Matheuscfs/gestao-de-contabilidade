/**
 * Kanban do mês — obrigações fiscais de todas as empresas numa competência.
 *
 * Um card é uma obrigação de uma empresa; as etapas do fluxo configurado são o
 * checklist dentro dele. A coluna é derivada do status + progresso (ver
 * `core/db/kanban.ts`), então marcar a primeira etapa já move o card sozinho.
 *
 * O quadro é gerado sob demanda ao abrir a competência: `prepararQuadro` é
 * idempotente, então "gerar o Kanban do mês" é só entrar no mês.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  COLUNAS,
  alternarEtapaCard,
  listarQuadro,
  moverCard,
  prepararQuadro,
  type CardKanban,
  type ColunaKanban,
} from "@/core/db/kanban";
import { semearFluxos } from "@/core/db/fluxos";
import { formatarData } from "@/utils/dates";
import { PainelIA } from "./painel-ia";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Competência padrão: o mês anterior — é o que se apura no mês corrente. */
function competenciaInicial(): { mes: number; ano: number } {
  const hoje = new Date();
  const mes = hoje.getMonth(); // 0-based = mês anterior em base 1
  return mes === 0
    ? { mes: 12, ano: hoje.getFullYear() - 1 }
    : { mes, ano: hoje.getFullYear() };
}

const COR_COLUNA: Record<ColunaKanban, { bg: string; cor: string }> = {
  A_FAZER: { bg: "#F0F2F6", cor: "#5B616E" },
  FAZENDO: { bg: "#EAF1FD", cor: "#2F63C9" },
  CONCLUIDO: { bg: "#E2F4EC", cor: "#0E885A" },
};

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  card,
  aberto,
  onAlternarAberto,
  onAlternarEtapa,
  onMover,
  onArrastar,
}: {
  card: CardKanban;
  aberto: boolean;
  onAlternarAberto: () => void;
  onAlternarEtapa: (etapaId: string, concluida: boolean) => void;
  onMover: (coluna: ColunaKanban) => void;
  onArrastar: (id: string) => void;
}) {
  const feitas = card.etapas.filter((e) => e.concluida).length;
  const total = card.etapas.length;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onArrastar(card.id);
      }}
      className="bg-surface border rounded-xl px-3.5 py-3 cursor-grab active:cursor-grabbing transition-colors"
      style={{ borderColor: card.atrasada ? "#F5C5C3" : "#E3E6EC" }}
    >
      <button onClick={onAlternarAberto} className="w-full text-left">
        <p className="font-bold text-[13.5px] text-ink leading-tight truncate">
          {card.empresaNome}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[12px] font-semibold text-ink-secondary">
            {card.obrigacaoNome}
          </span>
          {card.atrasada ? (
            <span className="text-[11.5px] font-bold" style={{ color: "#C0413B" }}>
              · atrasada
            </span>
          ) : (
            <span className="text-[11.5px] text-ink-muted tabular-nums">
              · vence {formatarData(card.vencimento, true)}
            </span>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-[3px]">
              {card.etapas.map((e) => (
                <span
                  key={e.id}
                  className="w-[13px] h-[5px] rounded-full"
                  style={{ background: e.concluida ? "#12A06B" : "#E3E6EC" }}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-ink-muted tabular-nums">
              {feitas}/{total}
            </span>
          </div>
        )}
      </button>

      {aberto && (
        <div className="mt-2.5 pt-2.5 border-t border-border-subtle flex flex-col gap-1.5">
          {total === 0 && (
            <p className="text-[12px] text-ink-muted">
              Sem etapas configuradas para {card.obrigacaoNome}. Ajuste em Fluxos.
            </p>
          )}
          {card.etapas.map((etapa) => (
            <button
              key={etapa.id}
              onClick={() => onAlternarEtapa(etapa.id, !etapa.concluida)}
              className="flex items-start gap-2 text-left group"
            >
              <span
                className="shrink-0 mt-[1px] w-[16px] h-[16px] rounded-[5px] flex items-center justify-center transition-colors"
                style={
                  etapa.concluida
                    ? { background: "#12A06B", border: "1px solid #12A06B" }
                    : { background: "#fff", border: "1px solid #D4D8E0" }
                }
              >
                {etapa.concluida && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                )}
              </span>
              <span
                className="text-[12.5px] leading-snug"
                style={{
                  color: etapa.concluida ? "#8A909B" : "#0E1116",
                  textDecoration: etapa.concluida ? "line-through" : "none",
                }}
              >
                {etapa.descricao}
              </span>
            </button>
          ))}

          <div className="flex gap-1.5 mt-1.5">
            {card.coluna !== "CONCLUIDO" ? (
              <button
                onClick={() => onMover("CONCLUIDO")}
                className="h-[28px] px-2.5 rounded-full text-[12px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#E2F4EC", color: "#0E885A" }}
              >
                Concluir
              </button>
            ) : (
              <button
                onClick={() => onMover("A_FAZER")}
                className="h-[28px] px-2.5 rounded-full text-[12px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#F0F2F6", color: "#5B616E" }}
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

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function KanbanScreen() {
  const inicial = useMemo(competenciaInicial, []);
  const [mes, setMes] = useState(inicial.mes);
  const [ano, setAno] = useState(inicial.ano);

  const [cards, setCards] = useState<CardKanban[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<ColunaKanban | null>(null);
  const [filtro, setFiltro] = useState("");
  const [painelIA, setPainelIA] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      await semearFluxos();
      await prepararQuadro(mes, ano);
      setCards(await listarQuadro(mes, ano));
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar o quadro de obrigações",
        mensagemUsuario: "Não foi possível montar o Kanban do mês.",
      });
    } finally {
      setCarregando(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(acao: () => Promise<void>, contexto: string) {
    try {
      await acao();
      setCards(await listarQuadro(mes, ano));
    } catch (e) {
      tratarErro(e, { contexto, mensagemUsuario: "Não foi possível salvar." });
    }
  }

  function trocarCompetencia(delta: number) {
    const base = new Date(ano, mes - 1 + delta, 1);
    setMes(base.getMonth() + 1);
    setAno(base.getFullYear());
  }

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return cards;
    return cards.filter(
      (c) =>
        c.empresaNome.toLowerCase().includes(termo) ||
        c.obrigacaoNome.toLowerCase().includes(termo)
    );
  }, [cards, filtro]);

  const porColuna = useMemo(() => {
    const mapa: Record<ColunaKanban, CardKanban[]> = {
      A_FAZER: [],
      FAZENDO: [],
      CONCLUIDO: [],
    };
    for (const c of filtrados) mapa[c.coluna].push(c);
    return mapa;
  }, [filtrados]);

  const atrasadas = cards.filter((c) => c.atrasada).length;

  return (
    <div className="animate-fade-in flex flex-col h-full" style={{ paddingTop: "2px" }}>
      {/* Cabeçalho: competência, busca e IA */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => trocarCompetencia(-1)}
            aria-label="Competência anterior"
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-ink-secondary hover:bg-surface-subtle transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="text-[15px] font-bold text-ink min-w-[150px] text-center">
            {MESES[mes - 1]} de {ano}
          </span>
          <button
            onClick={() => trocarCompetencia(1)}
            aria-label="Próxima competência"
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-ink-secondary hover:bg-surface-subtle transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <span
          className="flex items-center h-[34px] px-3.5 rounded-full"
          style={{ border: "1px solid #E3E6EC", background: "#fff" }}
        >
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar empresa ou obrigação"
            className="w-[210px] border-none outline-none bg-transparent text-[13.5px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
          />
        </span>

        {atrasadas > 0 && (
          <span
            className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[12px] font-bold"
            style={{ background: "#FBE9E7", color: "#C0413B" }}
          >
            {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
          </span>
        )}

        <button
          onClick={() => setPainelIA(true)}
          className="ml-auto inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-full text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#4078E6" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          Contar pra IA
        </button>
      </div>

      {/* Colunas */}
      {carregando ? (
        <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
          Montando o quadro…
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm font-medium text-ink-muted">
            Nenhuma obrigação nesta competência.
          </p>
          <p className="text-[12.5px] text-ink-muted max-w-[420px] text-center">
            O quadro nasce das empresas ativas e do regime de cada uma. Cadastre
            uma empresa ou escolha outro mês.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 flex-1 min-h-0">
          {COLUNAS.map((coluna) => {
            const lista = porColuna[coluna.id];
            const cor = COR_COLUNA[coluna.id];
            const alvo = sobre === coluna.id;
            return (
              <div
                key={coluna.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(coluna.id);
                }}
                onDragLeave={() => setSobre((s) => (s === coluna.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const id = arrastando;
                  setArrastando(null);
                  if (!id) return;
                  const card = cards.find((c) => c.id === id);
                  if (!card || card.coluna === coluna.id) return;
                  executar(
                    () => moverCard(id, coluna.id),
                    "mover card no quadro"
                  );
                }}
                className="flex-1 min-w-0 flex flex-col rounded-2xl p-2.5 transition-colors"
                style={{
                  background: alvo ? "#EAF1FD" : "#F7F8FA",
                  border: alvo ? "1px dashed #87BBF8" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-2 px-1.5 pb-2.5">
                  <span className="text-[13px] font-bold text-ink">
                    {coluna.label}
                  </span>
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-[19px] px-1.5 rounded-full text-[11px] font-bold tabular-nums"
                    style={{ background: cor.bg, color: cor.cor }}
                  >
                    {lista.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-0.5">
                  {lista.map((card) => (
                    <Card
                      key={card.id}
                      card={card}
                      aberto={abertos.has(card.id)}
                      onAlternarAberto={() =>
                        setAbertos((s) => {
                          const novo = new Set(s);
                          if (novo.has(card.id)) novo.delete(card.id);
                          else novo.add(card.id);
                          return novo;
                        })
                      }
                      onAlternarEtapa={(etapaId, concluida) =>
                        executar(
                          () => alternarEtapaCard(etapaId, concluida),
                          "marcar etapa"
                        )
                      }
                      onMover={(destino) =>
                        executar(() => moverCard(card.id, destino), "mover card")
                      }
                      onArrastar={setArrastando}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {painelIA && (
        <PainelIA
          cards={cards}
          onFechar={() => setPainelIA(false)}
          onAplicado={async (quantas) => {
            setCards(await listarQuadro(mes, ano));
            toast.sucesso(
              quantas === 1 ? "1 item marcado" : `${quantas} itens marcados`
            );
          }}
        />
      )}
    </div>
  );
}
