/**
 * Aba Obrigações — agenda de obrigações acessórias da empresa.
 *
 * As ocorrências são geradas pelo motor (`prepararObrigacoes`) a partir do
 * catálogo em `src/consts/obrigacoes.ts`; aqui ficam a agenda (atrasadas,
 * a vencer, concluídas) e a configuração de quais obrigações se aplicam.
 */

import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import type { Empresa } from "@/core/db/empresas";
import {
  atualizarStatusOcorrencia,
  definirObrigacaoAtiva,
  type OcorrenciaObrigacao,
} from "@/core/db/obrigacoes";
import {
  obrigacoesAplicaveis,
  rotuloCompetencia,
  type ObrigacaoDef,
} from "@/consts/obrigacoes";
import { formatarData } from "@/utils/dates";
import { formatarBRL } from "@/utils/money";

const CHIP_ESFERA: Record<string, { bg: string; cor: string; texto: string }> = {
  FEDERAL: { bg: "#EAF1FD", cor: "#2F63C9", texto: "federal" },
  ESTADUAL: { bg: "#F3E8FF", cor: "#7C4DD1", texto: "estadual" },
  MUNICIPAL: { bg: "#E0F2F1", cor: "#2BA89B", texto: "municipal" },
};

// ─── Modal: concluir guia com valor ───────────────────────────────────────────

function ModalConcluirGuia({
  ocorrencia,
  onConcluida,
  onFechar,
}: {
  ocorrencia: OcorrenciaObrigacao;
  onConcluida: () => void;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState(ocorrencia.valorCents ?? 0);
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    setSalvando(true);
    try {
      await atualizarStatusOcorrencia(
        ocorrencia.id,
        "PAGA",
        valor > 0 ? valor : null
      );
      toast.sucesso(`${ocorrencia.def?.nome ?? "Guia"} marcada como paga`);
      onConcluida();
    } catch (e) {
      tratarErro(e, {
        contexto: "concluir guia",
        mensagemUsuario: "Não foi possível atualizar a obrigação.",
      });
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[80]"
      style={{ background: "rgba(14,17,22,.42)" }}
      onClick={() => !salvando && onFechar()}
    >
      <div
        className="w-[420px] bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{ padding: "24px 30px 22px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[19px] font-bold text-ink tracking-tight">
          Pagar {ocorrencia.def?.nome ?? ocorrencia.obrigacaoCodigo}
        </p>
        <p className="text-[13px] text-ink-secondary mt-1 mb-4">
          {rotuloCompetencia(
            ocorrencia.def?.periodicidade ?? "MENSAL",
            ocorrencia.competenciaMes,
            ocorrencia.competenciaAno
          )}{" "}
          · vencimento {formatarData(ocorrencia.vencimento, true)}
        </p>

        <label className="block mb-5">
          <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
            Valor da guia{" "}
            <span className="font-normal text-ink-muted">(opcional)</span>
          </span>
          <MoneyInput centavos={valor} onChange={setValor} autoFocus aria-label="Valor da guia" />
        </label>

        <div className="flex gap-2.5">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
            style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={salvando}
            className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 transition-opacity"
            style={{
              background: "#4078E6",
              boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
              border: "none",
            }}
          >
            {salvando ? "Salvando…" : "Marcar como paga"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Linha de ocorrência ──────────────────────────────────────────────────────

function LinhaOcorrencia({
  ocorrencia,
  onMudou,
  onPagarGuia,
}: {
  ocorrencia: OcorrenciaObrigacao;
  onMudou: () => void;
  onPagarGuia: () => void;
}) {
  const [processando, setProcessando] = useState(false);
  const def = ocorrencia.def;
  const chipEsfera = CHIP_ESFERA[def?.esfera ?? "FEDERAL"];
  const concluida = ocorrencia.status !== "PENDENTE";

  async function mudarStatus(status: "ENTREGUE" | "DISPENSADA" | "PENDENTE") {
    setProcessando(true);
    try {
      await atualizarStatusOcorrencia(ocorrencia.id, status);
      if (status === "ENTREGUE") toast.sucesso(`${def?.nome ?? "Obrigação"} marcada como entregue`);
      if (status === "DISPENSADA") toast.sucesso(`${def?.nome ?? "Obrigação"} dispensada`);
      if (status === "PENDENTE") toast.sucesso("Obrigação reaberta");
      onMudou();
    } catch (e) {
      tratarErro(e, {
        contexto: "atualizar obrigação",
        mensagemUsuario: "Não foi possível atualizar a obrigação.",
      });
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div
      className="bg-surface border rounded-2xl px-5 py-3.5 flex items-center gap-4"
      style={{ borderColor: ocorrencia.atrasada ? "#F5C5C3" : "#E3E6EC", opacity: concluida ? 0.65 : 1 }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-[14.5px] text-ink">{def?.nome ?? ocorrencia.obrigacaoCodigo}</p>
          <span
            className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
            style={{ background: chipEsfera.bg, color: chipEsfera.cor }}
          >
            {chipEsfera.texto}
          </span>
          <span
            className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
            style={{ background: "#F0F2F6", color: "#5B616E" }}
          >
            {def?.tipo === "GUIA" ? "guia" : "declaração"}
          </span>
          {ocorrencia.atrasada && (
            <span
              className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
              style={{ background: "#FBE9E7", color: "#C0413B" }}
            >
              ATRASADA
            </span>
          )}
          {ocorrencia.status === "DISPENSADA" && (
            <span
              className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
              style={{ background: "#F0F2F6", color: "#5B616E" }}
            >
              DISPENSADA
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-ink-secondary mt-0.5">
          {rotuloCompetencia(
            def?.periodicidade ?? "MENSAL",
            ocorrencia.competenciaMes,
            ocorrencia.competenciaAno
          )}
          {" · "}
          {concluida
            ? ocorrencia.status === "PAGA"
              ? `paga${ocorrencia.valorCents ? ` — ${formatarBRL(ocorrencia.valorCents)}` : ""}`
              : ocorrencia.status === "ENTREGUE"
              ? "entregue"
              : "dispensada"
            : `vence ${formatarData(ocorrencia.vencimento, true)}`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {concluida ? (
          <button
            onClick={() => mudarStatus("PENDENTE")}
            disabled={processando}
            className="h-9 px-3.5 rounded-full font-semibold text-[13px] hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#5B616E" }}
          >
            Reabrir
          </button>
        ) : (
          <>
            <button
              onClick={() => mudarStatus("DISPENSADA")}
              disabled={processando}
              title="Não se aplica nesta competência (ex.: sem movimento)"
              className="h-9 px-3.5 rounded-full font-semibold text-[13px] hover:opacity-80 transition-opacity disabled:opacity-50"
              style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#5B616E" }}
            >
              Dispensar
            </button>
            {def?.tipo === "GUIA" ? (
              <button
                onClick={onPagarGuia}
                disabled={processando}
                className="h-9 px-4 rounded-full font-semibold text-[13px] text-white transition-opacity disabled:opacity-50"
                style={{ background: "#4078E6", border: "none" }}
              >
                Pagar
              </button>
            ) : (
              <button
                onClick={() => mudarStatus("ENTREGUE")}
                disabled={processando}
                className="h-9 px-4 rounded-full font-semibold text-[13px] text-white transition-opacity disabled:opacity-50"
                style={{ background: "#4078E6", border: "none" }}
              >
                Entregar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Aba ──────────────────────────────────────────────────────────────────────

export function AbaObrigacoes({
  empresa,
  temProLabore,
  ocorrencias,
  desativadas,
  onRecarregar,
}: {
  empresa: Empresa;
  temProLabore: boolean;
  ocorrencias: OcorrenciaObrigacao[];
  desativadas: Set<string>;
  onRecarregar: () => void;
}) {
  const [configurando, setConfigurando] = useState(false);
  const [pagandoGuia, setPagandoGuia] = useState<OcorrenciaObrigacao | null>(null);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  const ctx = {
    regime: empresa.regimeTributario,
    temFuncionarios: empresa.temFuncionarios,
    temProLabore,
  };
  const aplicaveis = obrigacoesAplicaveis(ctx);

  const atrasadas = ocorrencias.filter((o) => o.atrasada);
  const aVencer = ocorrencias.filter((o) => o.status === "PENDENTE" && !o.atrasada);
  const concluidas = ocorrencias
    .filter((o) => o.status !== "PENDENTE")
    .sort((a, b) => (b.concluidaEm ?? "").localeCompare(a.concluidaEm ?? ""));

  async function alternarObrigacao(def: ObrigacaoDef, ativa: boolean) {
    try {
      await definirObrigacaoAtiva(empresa.id, def.codigo, ativa);
      toast.sucesso(ativa ? `${def.nome} ativada` : `${def.nome} desativada`);
      onRecarregar();
    } catch (e) {
      tratarErro(e, {
        contexto: "configurar obrigação",
        mensagemUsuario: "Não foi possível alterar a configuração.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Contexto + configurar */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-[13px] text-ink-secondary leading-snug">
          Agenda gerada a partir do regime{" "}
          <strong className="text-ink">
            {empresa.regimeTributario === "SIMPLES" && empresa.anexoSimples
              ? `Simples Nacional (Anexo ${empresa.anexoSimples})`
              : empresa.regimeTributario === "MEI"
              ? "MEI"
              : empresa.regimeTributario === "PRESUMIDO"
              ? "Lucro Presumido"
              : "Lucro Real"}
          </strong>
          {temProLabore && ", com pró-labore"}
          {empresa.temFuncionarios && ", com funcionários"} — vencimentos já
          ajustados para dia útil.
        </p>
        <button
          onClick={() => setConfigurando(!configurando)}
          className="shrink-0 h-9 px-3.5 rounded-full font-semibold text-[13px] hover:opacity-80 transition-opacity"
          style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
        >
          {configurando ? "Fechar" : "Configurar"}
        </button>
      </div>

      {/* Painel de configuração */}
      {configurando && (
        <div className="bg-surface border rounded-2xl p-5" style={{ borderColor: "#E3E6EC" }}>
          <p className="text-[14px] font-bold text-ink mb-1">
            Obrigações desta empresa
          </p>
          <p className="text-[12.5px] text-ink-muted mb-4">
            Desative o que não se aplica (ex.: ISS em quem não presta serviço).
            Desativar remove as pendências futuras; o histórico concluído fica.
          </p>
          <div className="flex flex-col gap-2">
            {aplicaveis.map((def) => {
              const ativa = !desativadas.has(def.codigo);
              return (
                <button
                  key={def.codigo}
                  onClick={() => alternarObrigacao(def, !ativa)}
                  className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-left"
                  style={{ border: "1px solid #E3E6EC", opacity: ativa ? 1 : 0.6 }}
                >
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink">
                      {def.nome}
                    </span>
                    <span className="block text-[12px] text-ink-muted mt-0.5 leading-snug">
                      {def.descricao}
                    </span>
                  </span>
                  <span
                    className="shrink-0 w-[42px] h-[24px] rounded-full p-[3px] transition-colors"
                    style={{ background: ativa ? "#4078E6" : "#D4D8E0" }}
                  >
                    <span
                      className="block w-[18px] h-[18px] rounded-full bg-white transition-transform"
                      style={{ transform: ativa ? "translateX(18px)" : "translateX(0)" }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Atrasadas */}
      {atrasadas.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-2.5 px-0.5">
            <span className="text-[13px] font-semibold" style={{ color: "#C0413B" }}>
              Em atraso
            </span>
            <span className="flex-1 h-px bg-border-subtle" />
          </div>
          <div className="flex flex-col gap-2">
            {atrasadas.map((o) => (
              <LinhaOcorrencia
                key={o.id}
                ocorrencia={o}
                onMudou={onRecarregar}
                onPagarGuia={() => setPagandoGuia(o)}
              />
            ))}
          </div>
        </div>
      )}

      {/* A vencer */}
      <div>
        <div className="flex items-center gap-3 mb-2.5 px-0.5">
          <span className="text-[13px] font-semibold text-ink-muted">A vencer</span>
          <span className="flex-1 h-px bg-border-subtle" />
        </div>
        {aVencer.length === 0 ? (
          <p className="text-[13px] text-ink-muted py-4 text-center">
            Nada pendente por aqui — tudo em dia.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {aVencer.map((o) => (
              <LinhaOcorrencia
                key={o.id}
                ocorrencia={o}
                onMudou={onRecarregar}
                onPagarGuia={() => setPagandoGuia(o)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Concluídas */}
      {concluidas.length > 0 && (
        <div>
          <button
            onClick={() => setMostrarConcluidas(!mostrarConcluidas)}
            className="flex items-center gap-3 mb-2.5 px-0.5 w-full"
          >
            <span className="text-[13px] font-semibold text-ink-muted">
              Concluídas ({concluidas.length}) {mostrarConcluidas ? "▾" : "▸"}
            </span>
            <span className="flex-1 h-px bg-border-subtle" />
          </button>
          {mostrarConcluidas && (
            <div className="flex flex-col gap-2">
              {concluidas.slice(0, 12).map((o) => (
                <LinhaOcorrencia
                  key={o.id}
                  ocorrencia={o}
                  onMudou={onRecarregar}
                  onPagarGuia={() => setPagandoGuia(o)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal pagar guia */}
      {pagandoGuia && (
        <ModalConcluirGuia
          ocorrencia={pagandoGuia}
          onConcluida={() => {
            setPagandoGuia(null);
            onRecarregar();
          }}
          onFechar={() => setPagandoGuia(null)}
        />
      )}
    </div>
  );
}
