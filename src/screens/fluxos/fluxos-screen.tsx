/**
 * Fluxos — o procedimento do escritório para cada obrigação.
 *
 * O que a lei exige e quando vence continua em código (`consts/obrigacoes.ts`);
 * o que se edita aqui é como o escritório trabalha aquilo: gerar a guia, mandar
 * pro cliente, conferir o pró-labore. É daqui que sai o checklist dos cards do
 * Kanban — mudanças valem para os quadros gerados a partir de agora.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { CATALOGO_OBRIGACOES, type ObrigacaoDef } from "@/consts/obrigacoes";
import { LABEL_CONDICAO, type CondicaoEtapa } from "@/consts/fluxos";
import {
  adicionarEtapaFluxo,
  editarEtapaFluxo,
  excluirEtapaFluxo,
  listarFluxos,
  moverEtapaFluxo,
  semearFluxos,
  type EtapaFluxo,
} from "@/core/db/fluxos";

const CONDICOES: (CondicaoEtapa | null)[] = [
  null,
  "TEM_PRO_LABORE",
  "SEM_PRO_LABORE",
  "TEM_FUNCIONARIOS",
  "SEM_MOVIMENTO",
  "COM_MOVIMENTO",
];

const LABEL_ESFERA: Record<string, string> = {
  FEDERAL: "Federal",
  ESTADUAL: "Estadual",
  MUNICIPAL: "Municipal",
};

// ─── Linha de etapa ───────────────────────────────────────────────────────────

function LinhaEtapa({
  etapa,
  primeira,
  ultima,
  onSalvar,
  onExcluir,
  onMover,
}: {
  etapa: EtapaFluxo;
  primeira: boolean;
  ultima: boolean;
  onSalvar: (descricao: string, condicao: CondicaoEtapa | null) => void;
  onExcluir: () => void;
  onMover: (direcao: "cima" | "baixo") => void;
}) {
  const [descricao, setDescricao] = useState(etapa.descricao);
  const [condicao, setCondicao] = useState<CondicaoEtapa | null>(etapa.condicao);

  const sujo =
    descricao.trim() !== etapa.descricao || condicao !== etapa.condicao;

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{ border: "1px solid #E3E6EC", background: "#fff" }}
    >
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          onClick={() => onMover("cima")}
          disabled={primeira}
          aria-label="Subir etapa"
          className="w-[18px] h-[14px] flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-25 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        <button
          onClick={() => onMover("baixo")}
          disabled={ultima}
          aria-label="Descer etapa"
          className="w-[18px] h-[14px] flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-25 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-[14px] font-medium text-ink font-sans"
      />

      <select
        value={condicao ?? ""}
        onChange={(e) =>
          setCondicao((e.target.value || null) as CondicaoEtapa | null)
        }
        className="shrink-0 h-[30px] rounded-lg px-2 text-[12.5px] font-medium text-ink-secondary bg-surface-subtle outline-none cursor-pointer"
        style={{ border: "1px solid #E3E6EC" }}
      >
        {CONDICOES.map((c) => (
          <option key={c ?? "sempre"} value={c ?? ""}>
            {c ? LABEL_CONDICAO[c] : "sempre"}
          </option>
        ))}
      </select>

      {sujo && (
        <button
          onClick={() => onSalvar(descricao, condicao)}
          className="shrink-0 h-[30px] px-3 rounded-full text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#4078E6" }}
        >
          Salvar
        </button>
      )}

      <button
        onClick={onExcluir}
        aria-label="Excluir etapa"
        className="shrink-0 w-[28px] h-[28px] rounded-lg flex items-center justify-center text-ink-muted hover:text-[#D74A45] hover:bg-[#FEF2F2] transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}

// ─── Bloco de uma obrigação ───────────────────────────────────────────────────

function BlocoObrigacao({
  def,
  etapas,
  aberto,
  onAlternar,
  onRecarregar,
}: {
  def: ObrigacaoDef;
  etapas: EtapaFluxo[];
  aberto: boolean;
  onAlternar: () => void;
  onRecarregar: () => void;
}) {
  const [nova, setNova] = useState("");

  async function executar(acao: () => Promise<void>, contexto: string) {
    try {
      await acao();
      onRecarregar();
    } catch (e) {
      tratarErro(e, { contexto, mensagemUsuario: "Não foi possível salvar." });
    }
  }

  return (
    <div
      className="bg-surface border rounded-2xl overflow-hidden"
      style={{ borderColor: "#E3E6EC" }}
    >
      <button
        onClick={onAlternar}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-subtle transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[15px] text-ink truncate">{def.nome}</p>
            <span
              className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
              style={{ background: "#F0F2F6", color: "#5B616E" }}
            >
              {LABEL_ESFERA[def.esfera] ?? def.esfera}
            </span>
          </div>
          <p className="text-[12.5px] text-ink-secondary truncate mt-0.5">
            {etapas.length === 0
              ? "sem etapas — os cards nascem sem checklist"
              : `${etapas.length} etapa${etapas.length > 1 ? "s" : ""}: ${etapas
                  .map((e) => e.descricao)
                  .join(" › ")}`}
          </p>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8A909B"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: aberto ? "rotate(180deg)" : "none",
            transition: "transform .15s",
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="px-5 pb-4 flex flex-col gap-1.5">
          {etapas.map((etapa, i) => (
            <LinhaEtapa
              key={etapa.id}
              etapa={etapa}
              primeira={i === 0}
              ultima={i === etapas.length - 1}
              onSalvar={(descricao, condicao) =>
                executar(async () => {
                  await editarEtapaFluxo(etapa.id, { descricao, condicao });
                  toast.sucesso("Etapa atualizada");
                }, "editar etapa do fluxo")
              }
              onExcluir={() =>
                executar(
                  () => excluirEtapaFluxo(etapa.id),
                  "excluir etapa do fluxo"
                )
              }
              onMover={(direcao) =>
                executar(
                  () => moverEtapaFluxo(etapa.id, direcao),
                  "reordenar etapa"
                )
              }
            />
          ))}

          <div className="flex gap-2 mt-1">
            <span
              className="flex items-center flex-1 h-[38px] px-3.5 rounded-xl focus-within:border-brand transition-colors"
              style={{ border: "1px solid #D4D8E0", background: "#fff" }}
            >
              <input
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !nova.trim()) return;
                  executar(async () => {
                    await adicionarEtapaFluxo(def.codigo, {
                      descricao: nova,
                      condicao: null,
                    });
                    setNova("");
                  }, "adicionar etapa ao fluxo");
                }}
                placeholder="Nova etapa (ex.: Enviar guia ao cliente)"
                className="flex-1 min-w-0 border-none outline-none bg-transparent text-[14px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
              />
            </span>
            <button
              onClick={() =>
                executar(async () => {
                  if (!nova.trim()) return;
                  await adicionarEtapaFluxo(def.codigo, {
                    descricao: nova,
                    condicao: null,
                  });
                  setNova("");
                }, "adicionar etapa ao fluxo")
              }
              disabled={!nova.trim()}
              className="shrink-0 h-[38px] px-4 rounded-full text-[13.5px] font-semibold disabled:opacity-40 transition-opacity"
              style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
            >
              Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function FluxosScreen() {
  const [fluxos, setFluxos] = useState<Map<string, EtapaFluxo[]>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState("");

  const carregar = useCallback(async () => {
    try {
      await semearFluxos();
      setFluxos(await listarFluxos());
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar fluxos",
        mensagemUsuario: "Não foi possível carregar os fluxos.",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return CATALOGO_OBRIGACOES;
    return CATALOGO_OBRIGACOES.filter(
      (d) =>
        d.nome.toLowerCase().includes(termo) ||
        d.codigo.toLowerCase().includes(termo) ||
        d.descricao.toLowerCase().includes(termo)
    );
  }, [filtro]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
        Carregando…
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "820px", margin: "0 auto", width: "100%", paddingTop: "2px" }}
    >
      <p className="text-[13px] text-ink-secondary mb-4">
        As etapas de cada obrigação viram o checklist dos cards do Kanban. O
        prazo legal e a aplicabilidade continuam vindo do catálogo do app — aqui
        você define só como o escritório trabalha. Alterações valem para os
        quadros gerados daqui pra frente.
      </p>

      <span
        className="flex items-center h-[38px] px-3.5 rounded-full mb-4"
        style={{ border: "1px solid #E3E6EC", background: "#fff" }}
      >
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar obrigação (DAS, SPED, pró-labore…)"
          className="flex-1 border-none outline-none bg-transparent text-[14px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
        />
      </span>

      <div className="flex flex-col gap-2.5">
        {visiveis.map((def) => (
          <BlocoObrigacao
            key={def.codigo}
            def={def}
            etapas={fluxos.get(def.codigo) ?? []}
            aberto={abertos.has(def.codigo)}
            onAlternar={() =>
              setAbertos((s) => {
                const novo = new Set(s);
                if (novo.has(def.codigo)) novo.delete(def.codigo);
                else novo.add(def.codigo);
                return novo;
              })
            }
            onRecarregar={carregar}
          />
        ))}
      </div>
    </div>
  );
}
