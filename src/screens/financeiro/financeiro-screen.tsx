/**
 * Financeiro do escritório — a receber dos clientes e a pagar da casa.
 *
 * Nada aqui vem de Open Finance: é lançamento manual, digitado por quem cobra.
 * A pergunta que a tela responde não é "quanto entrou", é **"quem pagou no
 * prazo"** — por isso a aba Pontualidade existe e por isso o atraso é medido
 * em dias, não só sinalizado com uma cor.
 *
 * O status de cada lançamento é derivado do vencimento e da data de pagamento
 * (`consts/financeiro.ts`), nunca lido de uma coluna: cobrança que hoje está
 * em aberto amanhece atrasada sozinha.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/toast";
import { MoneyInput } from "@/components/money-input";
import { tratarErro } from "@/core/errors";
import {
  LABEL_CATEGORIA,
  LABEL_STATUS,
  competenciaDe,
  diasDeAtraso,
  diasVencido,
  resumirPontualidade,
  totalizar,
  type DirecaoLancamento,
  type StatusLancamento,
} from "@/consts/financeiro";
import {
  comStatus,
  desfazerPagamento,
  excluirLancamento,
  gerarMensalidades,
  listarLancamentos,
  listarRecebimentos,
  listarVencidos,
  registrarPagamento,
  type Lancamento,
  type LancamentoComStatus,
} from "@/core/db/financeiro";
import { listarEmpresas, type EmpresaComTotais } from "@/core/db/empresas";
import { formatarBRL } from "@/utils/money";
import { formatarData, hoje } from "@/utils/dates";
import { ModalLancamento } from "./modal-lancamento";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Aba = "RECEBER" | "PAGAR" | "PONTUALIDADE";

const CORES_STATUS: Record<StatusLancamento, { bg: string; borda: string; cor: string }> = {
  EM_ABERTO: { bg: "#F0F2F6", borda: "#E3E6EC", cor: "#5B616E" },
  ATRASADO: { bg: "#FBE9E7", borda: "#FCA5A5", cor: "#9B1C1C" },
  PAGO: { bg: "#E2F4EC", borda: "#B7E3CD", cor: "#0E885A" },
};

// ─── Blocos ───────────────────────────────────────────────────────────────────

function CardValor({
  rotulo,
  valor,
  detalhe,
  destaque,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  const estilo = alerta
    ? { background: "#FBE9E7", border: "1px solid #FCA5A5" }
    : destaque
    ? { background: "#EAF1FD", border: "1px solid #87BBF8" }
    : { background: "#fff", border: "1px solid #E3E6EC" };
  return (
    <div className="rounded-2xl px-4 py-3 min-w-[152px]" style={estilo}>
      <p className="text-[11.5px] font-semibold text-ink-muted uppercase tracking-wide">
        {rotulo}
      </p>
      <p className="text-[19px] font-bold text-ink tabular-nums mt-0.5">{valor}</p>
      {detalhe && <p className="text-[11.5px] text-ink-muted mt-0.5">{detalhe}</p>}
    </div>
  );
}

/**
 * Baixa do lançamento. Data e valor vêm preenchidos com o caminho comum (hoje,
 * valor cheio) mas continuam editáveis: pagamento com desconto ou fora do dia
 * é o que a pontualidade precisa registrar fielmente.
 */
function ModalBaixa({
  lancamento,
  onConfirmar,
  onFechar,
}: {
  lancamento: Lancamento;
  onConfirmar: (dataPagamento: string, valorPagoCents: number, forma: string) => void;
  onFechar: () => void;
}) {
  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [valorPagoCents, setValorPagoCents] = useState(lancamento.valorCents);
  const [forma, setForma] = useState("");

  const atraso = Math.max(
    0,
    Math.round(
      (Date.parse(`${dataPagamento}T00:00:00Z`) -
        Date.parse(`${lancamento.vencimento}T00:00:00Z`)) /
        86_400_000
    )
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[80]"
      style={{ background: "rgba(14,17,22,.42)" }}
      onClick={onFechar}
    >
      <div
        className="w-[420px] bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{ padding: "24px 28px 22px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[19px] font-bold text-ink tracking-tight">
          Registrar pagamento
        </p>
        <p className="text-[13px] text-ink-muted mt-1">
          {lancamento.contraparte} · {lancamento.descricao} · venceu em{" "}
          {formatarData(lancamento.vencimento, true)}
        </p>

        <div className="flex flex-col gap-3.5 mt-4">
          <label className="block">
            <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
              Data do pagamento
            </span>
            <span
              className="flex items-center h-[46px] px-4 bg-surface rounded-xl"
              style={{ border: "1px solid #D4D8E0" }}
            >
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink font-sans"
              />
            </span>
          </label>

          <label className="block">
            <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
              Valor recebido
            </span>
            <MoneyInput
              centavos={valorPagoCents}
              onChange={setValorPagoCents}
              aria-label="Valor recebido"
            />
            {valorPagoCents !== lancamento.valorCents && (
              <span className="block text-[12px] text-ink-muted mt-1.5">
                Cobrado {formatarBRL(lancamento.valorCents)} —{" "}
                {valorPagoCents > lancamento.valorCents ? "entrou a mais" : "entrou a menos"}{" "}
                {formatarBRL(Math.abs(valorPagoCents - lancamento.valorCents))}.
              </span>
            )}
          </label>

          <label className="block">
            <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
              Forma <span className="font-normal text-ink-muted">(opcional)</span>
            </span>
            <span
              className="flex items-center h-[46px] px-4 bg-surface rounded-xl"
              style={{ border: "1px solid #D4D8E0" }}
            >
              <input
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                placeholder="Pix, boleto, transferência…"
                className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
              />
            </span>
          </label>

          <p
            className="text-[12.5px] font-semibold rounded-xl px-3 py-2"
            style={
              atraso > 0
                ? { background: "#FBE9E7", color: "#9B1C1C" }
                : { background: "#E2F4EC", color: "#0E885A" }
            }
          >
            {atraso > 0
              ? `${atraso} dia${atraso > 1 ? "s" : ""} de atraso — entra no histórico do cliente.`
              : "Pago dentro do prazo."}
          </p>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onFechar}
            className="shrink-0 h-11 px-[20px] rounded-full font-semibold text-[14px] hover:opacity-80 transition-opacity"
            style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(dataPagamento, valorPagoCents, forma)}
            className="flex-1 h-11 rounded-full text-white font-semibold text-[14px] transition-opacity hover:opacity-90"
            style={{ background: "#0E885A", border: "none" }}
          >
            Confirmar pagamento
          </button>
        </div>
      </div>
    </div>
  );
}

function LinhaLancamento({
  l,
  hojeIso,
  onBaixar,
  onDesfazer,
  onEditar,
  onExcluir,
}: {
  l: LancamentoComStatus;
  hojeIso: string;
  onBaixar: () => void;
  onDesfazer: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const cor = CORES_STATUS[l.status];
  const vencido = diasVencido(l, hojeIso);
  const atraso = diasDeAtraso(l);

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{ background: "#fff", border: "1px solid #E3E6EC" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-ink truncate">
          {l.contraparte}
        </p>
        <p className="text-[12.5px] text-ink-muted truncate">
          {l.descricao} · {LABEL_CATEGORIA[l.categoria]} · vence{" "}
          {formatarData(l.vencimento, true)}
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
        {l.status === "ATRASADO" && ` · ${vencido}d`}
        {l.status === "PAGO" && atraso > 0 && ` · ${atraso}d`}
      </span>

      <div className="shrink-0 flex items-center gap-1.5">
        {l.status === "PAGO" ? (
          <button
            onClick={onDesfazer}
            title="Desfazer a baixa"
            className="h-[32px] px-3 rounded-full font-semibold text-[12.5px] hover:opacity-80 transition-opacity"
            style={{ border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }}
          >
            Desfazer
          </button>
        ) : (
          <button
            onClick={onBaixar}
            className="h-[32px] px-3 rounded-full font-semibold text-[12.5px] hover:opacity-90 transition-opacity"
            style={{ border: "1px solid #B7E3CD", background: "#E2F4EC", color: "#0E885A" }}
          >
            Dar baixa
          </button>
        )}
        <button
          onClick={onEditar}
          aria-label="Editar lançamento"
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          onClick={onExcluir}
          aria-label="Excluir lançamento"
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-ink-muted hover:text-danger transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function FinanceiroScreen() {
  const agoraData = new Date();
  const [competencia, setCompetencia] = useState({
    mes: agoraData.getMonth() + 1,
    ano: agoraData.getFullYear(),
  });
  const [aba, setAba] = useState<Aba>("RECEBER");

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vencidos, setVencidos] = useState<Lancamento[]>([]);
  const [recebimentos, setRecebimentos] = useState<Lancamento[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaComTotais[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [baixando, setBaixando] = useState<Lancamento | null>(null);

  // Congelado no carregamento: se cada linha chamasse `hoje()` por conta
  // própria, uma tela aberta na virada da meia-noite mostraria status
  // calculados em dias diferentes.
  const [hojeIso, setHojeIso] = useState(hoje());

  const chave = competenciaDe(competencia.mes, competencia.ano);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const agoraIso = hoje();
      setHojeIso(agoraIso);
      const [doMes, atrasados, todosRecebimentos, listaEmpresas] = await Promise.all([
        listarLancamentos(chave),
        listarVencidos(agoraIso),
        listarRecebimentos(),
        listarEmpresas(),
      ]);
      setLancamentos(doMes);
      setVencidos(atrasados);
      setRecebimentos(todosRecebimentos);
      setEmpresas(listaEmpresas);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar financeiro",
        mensagemUsuario: "Não foi possível carregar o financeiro.",
      });
    } finally {
      setCarregando(false);
    }
  }, [chave]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const doMes = useMemo(
    () => comStatus(lancamentos, hojeIso),
    [lancamentos, hojeIso]
  );
  const daAba = useMemo(
    () => doMes.filter((l) => l.direcao === (aba as DirecaoLancamento)),
    [doMes, aba]
  );
  const totais = useMemo(() => totalizar(daAba, hojeIso), [daAba, hojeIso]);

  /** Atrasados de competências anteriores — o que a visão mensal esconderia. */
  const atrasadosDeOutrosMeses = useMemo(
    () => vencidos.filter((l) => l.competencia !== chave),
    [vencidos, chave]
  );

  const pontualidade = useMemo(() => {
    const porEmpresa = new Map<
      string,
      { nome: string; lancamentos: Lancamento[] }
    >();
    for (const l of recebimentos) {
      const id = l.empresaId ?? `avulso:${l.contraparte}`;
      const atual = porEmpresa.get(id) ?? { nome: l.contraparte, lancamentos: [] };
      atual.lancamentos.push(l);
      porEmpresa.set(id, atual);
    }
    return [...porEmpresa.entries()]
      .map(([id, { nome, lancamentos: ls }]) => ({
        id,
        nome,
        resumo: resumirPontualidade(ls, hojeIso),
      }))
      // Pior primeiro: quem está devendo agora, depois quem atrasa mais.
      .sort(
        (a, b) =>
          b.resumo.valorEmAtrasoCents - a.resumo.valorEmAtrasoCents ||
          b.resumo.mediaDiasAtraso - a.resumo.mediaDiasAtraso
      );
  }, [recebimentos, hojeIso]);

  function trocarMes(delta: number) {
    setCompetencia(({ mes, ano }) => {
      const m = mes + delta;
      if (m < 1) return { mes: 12, ano: ano - 1 };
      if (m > 12) return { mes: 1, ano: ano + 1 };
      return { mes: m, ano };
    });
  }

  async function gerar() {
    try {
      const r = await gerarMensalidades(chave);
      await carregar();
      if (r.criadas === 0 && r.jaExistiam > 0) {
        toast.info(`As ${r.jaExistiam} mensalidades deste mês já estavam lançadas`);
      } else {
        toast.sucesso(
          `${r.criadas} mensalidade${r.criadas === 1 ? "" : "s"} gerada${
            r.criadas === 1 ? "" : "s"
          }`
        );
      }
      if (r.semHonorario.length > 0) {
        toast.aviso(
          `${r.semHonorario.length} empresa${
            r.semHonorario.length === 1 ? " ativa está" : "s ativas estão"
          } sem honorário cadastrado e ficaram de fora`
        );
      }
    } catch (e) {
      tratarErro(e, {
        contexto: "gerar mensalidades",
        mensagemUsuario: "Não foi possível gerar as mensalidades.",
      });
    }
  }

  async function baixar(dataPagamento: string, valorPagoCents: number, forma: string) {
    if (!baixando) return;
    try {
      await registrarPagamento(baixando.id, {
        dataPagamento,
        valorPagoCents,
        formaPagamento: forma || null,
      });
      setBaixando(null);
      await carregar();
      toast.sucesso("Pagamento registrado");
    } catch (e) {
      tratarErro(e, {
        contexto: "registrar pagamento",
        mensagemUsuario: "Não foi possível registrar o pagamento.",
      });
    }
  }

  async function executar(acao: () => Promise<void>, contexto: string, ok: string) {
    try {
      await acao();
      await carregar();
      toast.sucesso(ok);
    } catch (e) {
      tratarErro(e, { contexto, mensagemUsuario: `Não foi possível ${contexto}.` });
    }
  }

  return (
    <div className="flex flex-col gap-4 px-10 pb-8 overflow-y-auto">
      {/* Competência + abas */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => trocarMes(-1)}
            aria-label="Mês anterior"
            className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-ink-secondary hover:text-ink transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="text-[16px] font-bold text-ink min-w-[150px] text-center select-none">
            {MESES[competencia.mes - 1]} de {competencia.ano}
          </span>
          <button
            onClick={() => trocarMes(1)}
            aria-label="Próximo mês"
            className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-ink-secondary hover:text-ink transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1.5">
          {([
            ["RECEBER", "A receber"],
            ["PAGAR", "A pagar"],
            ["PONTUALIDADE", "Pontualidade"],
          ] as [Aba, string][]).map(([id, label]) => {
            const ativo = aba === id;
            return (
              <button
                key={id}
                onClick={() => setAba(id)}
                className="h-[34px] px-3.5 rounded-full font-semibold text-[13.5px] transition-colors"
                style={
                  ativo
                    ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                    : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex gap-2">
          {aba === "RECEBER" && (
            <button
              onClick={gerar}
              className="h-[36px] px-3.5 rounded-full font-semibold text-[13.5px] hover:opacity-80 transition-opacity"
              style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
            >
              Gerar mensalidades do mês
            </button>
          )}
          {aba !== "PONTUALIDADE" && (
            <button
              onClick={() => {
                setEditando(null);
                setModalAberto(true);
              }}
              className="h-[36px] px-4 rounded-full text-white font-semibold text-[13.5px] transition-opacity hover:opacity-90"
              style={{ background: "#4078E6", border: "none" }}
            >
              Novo lançamento
            </button>
          )}
        </div>
      </div>

      {/* Atrasados de meses anteriores — nunca some ao trocar de competência */}
      {atrasadosDeOutrosMeses.length > 0 && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: "#FBE9E7", border: "1px solid #FCA5A5" }}
        >
          <p className="text-[13px] font-bold" style={{ color: "#9B1C1C" }}>
            {atrasadosDeOutrosMeses.length} lançamento
            {atrasadosDeOutrosMeses.length > 1 ? "s vencidos" : " vencido"} de
            outras competências —{" "}
            {formatarBRL(
              atrasadosDeOutrosMeses.reduce((acc, l) => acc + l.valorCents, 0)
            )}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "#9B1C1C", opacity: 0.85 }}>
            {atrasadosDeOutrosMeses
              .slice(0, 4)
              .map((l) => `${l.contraparte} (${l.competencia})`)
              .join(" · ")}
            {atrasadosDeOutrosMeses.length > 4 &&
              ` · e mais ${atrasadosDeOutrosMeses.length - 4}`}
          </p>
        </div>
      )}

      {carregando ? (
        <p className="text-[13.5px] text-ink-muted">Carregando…</p>
      ) : aba === "PONTUALIDADE" ? (
        <div className="flex flex-col gap-2">
          {pontualidade.length === 0 ? (
            <p className="text-[13.5px] text-ink-muted">
              Ainda não há cobranças lançadas. Gere as mensalidades do mês para
              começar a medir a pontualidade dos clientes.
            </p>
          ) : (
            pontualidade.map(({ id, nome, resumo }) => (
              <div
                key={id}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: "#fff", border: "1px solid #E3E6EC" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-ink truncate">{nome}</p>
                  <p className="text-[12.5px] text-ink-muted">
                    {resumo.pagos === 0
                      ? "sem pagamento registrado ainda"
                      : `${resumo.pagos} pagamento${resumo.pagos > 1 ? "s" : ""} · ${
                          resumo.emDia
                        } no prazo · ${resumo.atrasados} em atraso`}
                    {resumo.piorAtrasoDias > 0 &&
                      ` · pior atraso ${resumo.piorAtrasoDias}d`}
                  </p>
                </div>

                {resumo.valorEmAtrasoCents > 0 && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                    style={{ background: "#FBE9E7", border: "1px solid #FCA5A5", color: "#9B1C1C" }}
                  >
                    devendo {formatarBRL(resumo.valorEmAtrasoCents)}
                  </span>
                )}

                <div className="shrink-0 text-right w-[112px]">
                  <p className="text-[17px] font-bold tabular-nums text-ink">
                    {resumo.percentualEmDia === null
                      ? "—"
                      : `${Math.round(resumo.percentualEmDia * 100)}%`}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {resumo.percentualEmDia === null
                      ? "sem histórico"
                      : `no prazo · média ${resumo.mediaDiasAtraso.toFixed(1)}d`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2.5">
            <CardValor
              rotulo={aba === "RECEBER" ? "Previsto no mês" : "A pagar no mês"}
              valor={formatarBRL(totais.previstoCents)}
              detalhe={`${daAba.length} lançamento${daAba.length === 1 ? "" : "s"}`}
            />
            <CardValor
              rotulo={aba === "RECEBER" ? "Recebido" : "Pago"}
              valor={formatarBRL(totais.liquidadoCents)}
              destaque
            />
            <CardValor rotulo="Em aberto" valor={formatarBRL(totais.emAbertoCents)} />
            {totais.atrasadoCents > 0 && (
              <CardValor
                rotulo="Atrasado"
                valor={formatarBRL(totais.atrasadoCents)}
                alerta
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            {daAba.length === 0 ? (
              <p className="text-[13.5px] text-ink-muted">
                {aba === "RECEBER"
                  ? "Nenhuma cobrança nesta competência. Use “Gerar mensalidades do mês” para lançar os honorários de todos os clientes ativos de uma vez."
                  : "Nenhuma despesa lançada nesta competência."}
              </p>
            ) : (
              daAba.map((l) => (
                <LinhaLancamento
                  key={l.id}
                  l={l}
                  hojeIso={hojeIso}
                  onBaixar={() => setBaixando(l)}
                  onDesfazer={() =>
                    executar(
                      () => desfazerPagamento(l.id),
                      "desfazer a baixa",
                      "Baixa desfeita"
                    )
                  }
                  onEditar={() => {
                    setEditando(l);
                    setModalAberto(true);
                  }}
                  onExcluir={() =>
                    executar(
                      () => excluirLancamento(l.id),
                      "excluir o lançamento",
                      "Lançamento excluído"
                    )
                  }
                />
              ))
            )}
          </div>
        </>
      )}

      {modalAberto && (
        <ModalLancamento
          editando={editando}
          direcaoInicial={aba === "PAGAR" ? "PAGAR" : "RECEBER"}
          competencia={chave}
          empresas={empresas}
          onSalvo={() => {
            setModalAberto(false);
            setEditando(null);
            void carregar();
            toast.sucesso("Lançamento salvo");
          }}
          onFechar={() => {
            setModalAberto(false);
            setEditando(null);
          }}
        />
      )}

      {baixando && (
        <ModalBaixa
          lancamento={baixando}
          onConfirmar={baixar}
          onFechar={() => setBaixando(null)}
        />
      )}
    </div>
  );
}
