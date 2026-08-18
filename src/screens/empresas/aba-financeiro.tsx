/**
 * Aba Financeiro da empresa — o histórico de cobrança daquele cliente.
 *
 * A tela `/financeiro` responde "como está o mês do escritório". Esta responde
 * outra pergunta, que é a que se faz com o cliente na frente: **este aqui paga
 * em dia?** Por isso o destaque é a pontualidade e o histórico completo, não a
 * competência corrente.
 *
 * Só lê: lançar e dar baixa continua na tela do financeiro, para não existirem
 * dois lugares fazendo a mesma escrita.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { tratarErro } from "@/core/errors";
import {
  LABEL_CATEGORIA,
  LABEL_STATUS,
  diasDeAtraso,
  diasVencido,
  resumirPontualidade,
  type StatusLancamento,
} from "@/consts/financeiro";
import {
  comStatus,
  listarLancamentosDaEmpresa,
  type LancamentoComStatus,
} from "@/core/db/financeiro";
import type { Empresa } from "@/core/db/empresas";
import { formatarBRL } from "@/utils/money";
import { formatarData, hoje } from "@/utils/dates";

const CORES_STATUS: Record<StatusLancamento, { bg: string; borda: string; cor: string }> = {
  EM_ABERTO: { bg: "#F0F2F6", borda: "#E3E6EC", cor: "#5B616E" },
  ATRASADO: { bg: "#FBE9E7", borda: "#FCA5A5", cor: "#9B1C1C" },
  PAGO: { bg: "#E2F4EC", borda: "#B7E3CD", cor: "#0E885A" },
};

function CardValor({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className="flex-1 min-w-[148px] rounded-2xl px-4 py-3.5"
      style={
        alerta
          ? { background: "#FBE9E7", border: "1px solid #FCA5A5" }
          : { background: "#fff", border: "1px solid #E3E6EC" }
      }
    >
      <p className="text-[12px] font-semibold text-ink-secondary">{rotulo}</p>
      <p className="font-bold text-[19px] tabular-nums tracking-tight mt-1 text-ink">
        {valor}
      </p>
      {detalhe && <p className="text-[11.5px] text-ink-muted mt-0.5">{detalhe}</p>}
    </div>
  );
}

export function AbaFinanceiro({ empresa }: { empresa: Empresa }) {
  const [lancamentos, setLancamentos] = useState<LancamentoComStatus[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [hojeIso] = useState(hoje);

  const carregar = useCallback(async () => {
    try {
      const lista = await listarLancamentosDaEmpresa(empresa.id);
      setLancamentos(comStatus(lista, hojeIso));
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar o financeiro da empresa",
        mensagemUsuario: "Não foi possível carregar os lançamentos.",
      });
    } finally {
      setCarregando(false);
    }
  }, [empresa.id, hojeIso]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumo = useMemo(
    () => resumirPontualidade(lancamentos, hojeIso),
    [lancamentos, hojeIso]
  );
  const recebidoCents = useMemo(
    () =>
      lancamentos
        .filter((l) => l.direcao === "RECEBER" && l.status === "PAGO")
        .reduce((acc, l) => acc + l.valorPagoCents, 0),
    [lancamentos]
  );

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
        Carregando…
      </div>
    );
  }

  if (lancamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-1.5">
        <p className="text-sm font-medium text-ink-muted">
          Nenhuma cobrança lançada para esta empresa.
        </p>
        <p className="text-[12.5px] text-ink-muted">
          {empresa.honorariosCents > 0
            ? `Honorário de ${formatarBRL(empresa.honorariosCents)} cadastrado — use "Gerar mensalidades do mês" no Financeiro do escritório.`
            : "Cadastre o honorário mensal em Editar dados para o financeiro passar a gerar as cobranças."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2.5">
        <CardValor
          rotulo="Pontualidade"
          valor={
            resumo.percentualEmDia === null
              ? "—"
              : `${Math.round(resumo.percentualEmDia * 100)}%`
          }
          detalhe={
            resumo.pagos === 0
              ? "sem pagamento registrado"
              : `${resumo.emDia} de ${resumo.pagos} no prazo`
          }
        />
        <CardValor
          rotulo="Atraso médio"
          valor={`${resumo.mediaDiasAtraso.toFixed(1)} d`}
          detalhe={
            resumo.piorAtrasoDias > 0
              ? `pior atraso: ${resumo.piorAtrasoDias} dias`
              : "nunca atrasou"
          }
        />
        <CardValor rotulo="Total recebido" valor={formatarBRL(recebidoCents)} />
        {resumo.valorEmAtrasoCents > 0 && (
          <CardValor
            rotulo="Em atraso agora"
            valor={formatarBRL(resumo.valorEmAtrasoCents)}
            detalhe={`${resumo.emAtrasoAgora} cobrança(s) vencida(s)`}
            alerta
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        {lancamentos.map((l) => {
          const cor = CORES_STATUS[l.status];
          const atraso = l.status === "PAGO" ? diasDeAtraso(l) : diasVencido(l, hojeIso);
          return (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{ background: "#fff", border: "1px solid #E3E6EC" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink truncate">
                  {l.descricao}
                </p>
                <p className="text-[12.5px] text-ink-muted truncate">
                  {LABEL_CATEGORIA[l.categoria]} · competência {l.competencia} ·
                  venceu {formatarData(l.vencimento, true)}
                  {l.dataPagamento && ` · pago ${formatarData(l.dataPagamento, true)}`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[15px] font-bold text-ink tabular-nums">
                  {formatarBRL(l.valorCents)}
                </p>
                {l.status === "PAGO" && l.valorPagoCents !== l.valorCents && (
                  <p className="text-[11.5px] text-ink-muted tabular-nums">
                    recebido {formatarBRL(l.valorPagoCents)}
                  </p>
                )}
              </div>

              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                style={{ background: cor.bg, border: `1px solid ${cor.borda}`, color: cor.cor }}
              >
                {LABEL_STATUS[l.status]}
                {atraso > 0 && ` · ${atraso}d`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
