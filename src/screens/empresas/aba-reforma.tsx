/**
 * Aba Reforma — em que ponto da transição 2026–2033 a empresa está,
 * o que muda a seguir e (no Simples) a opção de como apurar IBS/CBS.
 */

import { useState } from "react";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  definirRegimeIbsCbs,
  type Empresa,
  type RegimeIbsCbs,
} from "@/core/db/empresas";
import {
  ANO_DECISAO_SIMPLES,
  DESCRICAO_REGIME_IBS_CBS,
  FASES_REFORMA,
  LABEL_REGIME_IBS_CBS,
  situacaoDaFase,
  type FaseReforma,
} from "@/consts/reforma";

const OPCOES_SIMPLES: RegimeIbsCbs[] = [
  "SIMPLES_DAS",
  "SIMPLES_HIBRIDO",
  "REGULAR",
];

function rotuloFase(fase: FaseReforma): string {
  return fase.anoFim ? `${fase.ano}–${fase.anoFim}` : String(fase.ano);
}

export function AbaReforma({
  empresa,
  onRecarregar,
}: {
  empresa: Empresa;
  onRecarregar: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const anoAtual = new Date().getFullYear();
  const regime = empresa.regimeTributario;

  async function escolherOpcao(opcao: RegimeIbsCbs) {
    setSalvando(true);
    try {
      await definirRegimeIbsCbs(empresa.id, opcao);
      toast.sucesso("Opção de IBS/CBS registrada");
      onRecarregar();
    } catch (e) {
      tratarErro(e, {
        contexto: "definir regime IBS/CBS",
        mensagemUsuario: "Não foi possível salvar a opção.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Decisão do Simples */}
      {regime === "SIMPLES" && (
        <div
          className="bg-surface border rounded-2xl p-5"
          style={{ borderColor: "#E3E6EC" }}
        >
          <p className="text-[14px] font-bold text-ink">
            Como apurar IBS/CBS?
          </p>
          <p className="text-[12.5px] text-ink-muted mt-0.5 mb-3.5">
            A escolha vale a partir de {ANO_DECISAO_SIMPLES} e muda a agenda de
            obrigações desta empresa. A pergunta-chave: seus clientes são
            principalmente empresas (que aproveitam crédito) ou consumidor final?
          </p>
          <div className="flex flex-col gap-2">
            {OPCOES_SIMPLES.map((opcao) => {
              const ativa = empresa.regimeIbsCbs === opcao;
              return (
                <button
                  key={opcao}
                  onClick={() => escolherOpcao(opcao)}
                  disabled={salvando}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors disabled:opacity-60"
                  style={
                    ativa
                      ? { border: "1px solid #87BBF8", background: "#EAF1FD" }
                      : { border: "1px solid #E3E6EC", background: "#fff" }
                  }
                >
                  <span
                    className="mt-0.5 w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center"
                    style={
                      ativa
                        ? { border: "5px solid #4078E6", background: "#fff" }
                        : { border: "1.5px solid #C7CCD6", background: "#fff" }
                    }
                  />
                  <span className="min-w-0">
                    <span
                      className="block text-[13.5px] font-semibold"
                      style={{ color: ativa ? "#2F63C9" : "#0E1116" }}
                    >
                      {LABEL_REGIME_IBS_CBS[opcao]}
                    </span>
                    <span className="block text-[12px] text-ink-secondary mt-0.5 leading-snug">
                      {DESCRICAO_REGIME_IBS_CBS[opcao]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!empresa.regimeIbsCbs && (
            <p className="text-[12px] font-semibold mt-3" style={{ color: "#B9791C" }}>
              Opção ainda não definida — sem escolha, a empresa segue com IBS/CBS
              por dentro do DAS.
            </p>
          )}
        </div>
      )}

      {/* Linha do tempo */}
      <div>
        <div className="flex items-center gap-3 mb-3 px-0.5">
          <span className="text-[13px] font-semibold text-ink-muted">
            Transição 2026–2033
          </span>
          <span className="flex-1 h-px bg-border-subtle" />
        </div>

        <div className="flex flex-col">
          {FASES_REFORMA.map((fase, i) => {
            const situacao = situacaoDaFase(fase, anoAtual);
            const textoRegime = fase.porRegime?.[regime];
            const ultima = i === FASES_REFORMA.length - 1;
            return (
              <div key={fase.ano} className="flex gap-4">
                {/* Trilho */}
                <div className="flex flex-col items-center w-[70px] shrink-0">
                  <span
                    className="inline-flex items-center justify-center h-[26px] px-2.5 rounded-full text-[12.5px] font-bold tabular-nums shrink-0"
                    style={
                      situacao === "ATUAL"
                        ? { background: "#4078E6", color: "#fff" }
                        : situacao === "PASSADA"
                        ? { background: "#E2F4EC", color: "#0E885A" }
                        : { background: "#F0F2F6", color: "#5B616E" }
                    }
                  >
                    {rotuloFase(fase)}
                  </span>
                  {!ultima && (
                    <span
                      className="w-px flex-1 my-1.5"
                      style={{
                        background: situacao === "PASSADA" ? "#B9E2CE" : "#E3E6EC",
                      }}
                    />
                  )}
                </div>

                {/* Conteúdo */}
                <div className={`min-w-0 flex-1 ${ultima ? "" : "pb-5"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[14.5px] text-ink">{fase.titulo}</p>
                    {situacao === "ATUAL" && (
                      <span
                        className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
                        style={{ background: "#EAF1FD", color: "#2F63C9" }}
                      >
                        VOCÊ ESTÁ AQUI
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-ink-secondary mt-1 leading-relaxed">
                    {fase.geral}
                  </p>
                  {textoRegime && (
                    <div
                      className="mt-2 rounded-xl px-3.5 py-2.5"
                      style={
                        situacao === "ATUAL"
                          ? { background: "#EAF1FD", border: "1px solid #C7DBFA" }
                          : { background: "#F7F9FC", border: "1px solid #E3E6EC" }
                      }
                    >
                      <p className="text-[12.5px] font-medium text-ink leading-snug">
                        <strong>Para esta empresa:</strong> {textoRegime}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[12px] text-ink-muted leading-snug">
        Base: EC 132/2023 e LC 214/2025. As obrigações da agenda já acompanham a
        transição — PIS/Cofins param na competência dez/2026 e a CBS entra em
        2027 automaticamente. Prazos das guias novas ainda dependem de
        regulamentação e estão marcados como estimados.
      </p>
    </div>
  );
}
