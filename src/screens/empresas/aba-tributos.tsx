/**
 * Aba Tributos — estimativas por regime a partir das receitas mensais.
 *
 * Simples: RBT12 → alíquota efetiva → DAS estimado, com Fator R.
 * Presumido: PIS/Cofins mensais + IRPJ/CSLL do trimestre por presunção.
 * MEI: DAS fixo + acompanhamento do limite anual.
 * Pró-labore: INSS/IRRF 2026 por sócio (com o redutor da Lei 15.270/2025).
 */

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  definirAtividadePresumido,
  type AtividadePresumido,
  type Empresa,
} from "@/core/db/empresas";
import type { SocioDaEmpresa } from "@/core/db/socios";
import type { Funcionario } from "@/core/db/funcionarios";
import {
  listarReceitas,
  salvarReceita,
  type ReceitaMensal,
} from "@/core/db/receitas-empresa";
import {
  calcularFatorR,
  calcularPresumidoMes,
  calcularPresumidoTrimestre,
  calcularProLabore,
  PRO_LABORE_MINIMO_CENTS,
  calcularSimples,
  LABEL_ATIVIDADE_PRESUMIDO,
  MEI_ICMS_CENTS,
  MEI_INSS_CENTS,
  MEI_ISS_CENTS,
  MEI_LIMITE_CENTS,
  TRIBUTOS_ANO_REFERENCIA,
} from "@/consts/tributos";
import { formatarBRL } from "@/utils/money";
import { mesAnterior, mesAnoAtual } from "@/utils/dates";

const ESTILO_CARD = { borderColor: "#E3E6EC" };

function rotuloMes(mes: number, ano: number): string {
  return format(new Date(ano, mes - 1, 1), "MMM/yyyy", { locale: ptBR });
}

function formatarPercent(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

// ─── Blocos visuais ───────────────────────────────────────────────────────────

function CardValor({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className="flex-1 min-w-[150px] bg-surface border rounded-2xl px-4 py-3.5"
      style={destaque ? { ...ESTILO_CARD, background: "#EAF1FD", borderColor: "#C7DBFA" } : ESTILO_CARD}
    >
      <p className="text-[12px] font-semibold text-ink-secondary">{rotulo}</p>
      <p
        className="font-bold text-[19px] tabular-nums tracking-tight mt-1"
        style={{ color: destaque ? "#2F63C9" : "#0E1116" }}
      >
        {valor}
      </p>
      {detalhe && <p className="text-[11.5px] text-ink-muted mt-0.5">{detalhe}</p>}
    </div>
  );
}

function TituloSecao({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-2.5 px-0.5">
      <span className="text-[13px] font-semibold text-ink-muted">{children}</span>
      <span className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

// ─── Modal de receita do mês ──────────────────────────────────────────────────

function ModalReceita({
  empresaId,
  mes,
  ano,
  valorAtual,
  onSalvo,
  onFechar,
}: {
  empresaId: string;
  mes: number;
  ano: number;
  valorAtual: number;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [valor, setValor] = useState(valorAtual);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarReceita(empresaId, mes, ano, valor);
      toast.sucesso(`Receita de ${rotuloMes(mes, ano)} registrada`);
      onSalvo();
    } catch (e) {
      tratarErro(e, {
        contexto: "salvar receita",
        mensagemUsuario: "Não foi possível salvar a receita.",
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
        className="w-[400px] bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{ padding: "24px 30px 22px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[19px] font-bold text-ink tracking-tight mb-1">
          Receita de {rotuloMes(mes, ano)}
        </p>
        <p className="text-[13px] text-ink-secondary mb-4">
          Faturamento bruto da competência — alimenta RBT12 e as bases de cálculo.
        </p>
        <MoneyInput centavos={valor} onChange={setValor} autoFocus aria-label="Receita do mês" />
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
            style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 transition-opacity"
            style={{
              background: "#4078E6",
              boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
              border: "none",
            }}
          >
            {salvando ? "Salvando…" : "Salvar receita"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Aba ──────────────────────────────────────────────────────────────────────

export function AbaTributos({
  empresa,
  socios,
  funcionarios,
  onRecarregar,
}: {
  empresa: Empresa;
  socios: SocioDaEmpresa[];
  funcionarios: Funcionario[];
  onRecarregar: () => void;
}) {
  // Mês de apuração: último mês encerrado.
  const atual = mesAnoAtual();
  const apuracao = mesAnterior(atual.mes, atual.ano);

  const [receitas, setReceitas] = useState<ReceitaMensal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoReceita, setEditandoReceita] = useState<ReceitaMensal | null>(null);

  const carregarReceitas = useCallback(async () => {
    try {
      // 13 competências: 12 anteriores (RBT12) + o mês de apuração.
      setReceitas(await listarReceitas(empresa.id, apuracao.mes, apuracao.ano, 13));
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar receitas",
        mensagemUsuario: "Não foi possível carregar as receitas.",
      });
    } finally {
      setCarregando(false);
    }
  }, [empresa.id, apuracao.mes, apuracao.ano]);

  useEffect(() => {
    carregarReceitas();
  }, [carregarReceitas]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
        Carregando…
      </div>
    );
  }

  const receitaMes = receitas[receitas.length - 1];
  const rbt12Cents = receitas
    .slice(0, 12)
    .reduce((acc, r) => acc + r.receitaCents, 0);

  // Folha aproximada: pró-labores vigentes + salários de funcionários ativos.
  const proLaboreMensalCents = socios
    .filter((s) => s.dataSaida == null)
    .reduce((acc, s) => acc + s.proLaboreCents, 0);
  const salariosMensalCents = funcionarios
    .filter((f) => f.dataDemissao == null)
    .reduce((acc, f) => acc + f.salarioCents, 0);
  const folha12mCents = (proLaboreMensalCents + salariosMensalCents) * 12;

  const regime = empresa.regimeTributario;
  const comCppPatronal =
    regime === "PRESUMIDO" ||
    regime === "REAL" ||
    (regime === "SIMPLES" && empresa.anexoSimples === "IV");
  const sociosComProLabore = socios.filter(
    (s) => s.dataSaida == null && s.proLaboreCents > 0
  );

  // Trimestre da apuração (Presumido): meses do trimestre que contém o mês de apuração.
  const trimestre = Math.ceil(apuracao.mes / 3);
  const receitaTrimestreCents = receitas
    .filter(
      (r) => r.ano === apuracao.ano && Math.ceil(r.mes / 3) === trimestre
    )
    .reduce((acc, r) => acc + r.receitaCents, 0);

  // Receita acumulada no ano da apuração (limite do MEI).
  const receitaAnoCents = receitas
    .filter((r) => r.ano === apuracao.ano)
    .reduce((acc, r) => acc + r.receitaCents, 0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[12.5px] text-ink-muted leading-snug">
        Estimativas com as tabelas de {TRIBUTOS_ANO_REFERENCIA}, apuração de{" "}
        <strong className="text-ink-secondary">{rotuloMes(apuracao.mes, apuracao.ano)}</strong> —
        para acompanhamento, não substituem a apuração oficial.
      </p>

      {/* ── Receitas mensais ──────────────────────────────────────────────── */}
      <div>
        <TituloSecao>Receitas mensais (alimentam os cálculos)</TituloSecao>
        <div className="grid grid-cols-4 gap-2">
          {receitas.map((r) => (
            <button
              key={`${r.ano}-${r.mes}`}
              onClick={() => setEditandoReceita(r)}
              className="bg-surface border rounded-xl px-3 py-2.5 text-left hover:border-brand/40 transition-all"
              style={ESTILO_CARD}
            >
              <p className="text-[11.5px] font-semibold text-ink-muted">
                {rotuloMes(r.mes, r.ano)}
              </p>
              <p
                className="text-[13.5px] font-bold tabular-nums mt-0.5"
                style={{ color: r.registrada ? "#0E1116" : "#B8BDC7" }}
              >
                {r.registrada ? formatarBRL(r.receitaCents) : "—"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Painel por regime ─────────────────────────────────────────────── */}
      {regime === "SIMPLES" && empresa.anexoSimples && (
        <div>
          <TituloSecao>Simples Nacional — Anexo {empresa.anexoSimples}</TituloSecao>
          {(() => {
            const simples = calcularSimples(
              empresa.anexoSimples,
              rbt12Cents,
              receitaMes.receitaCents
            );
            const fatorR =
              empresa.anexoSimples === "III" || empresa.anexoSimples === "V"
                ? calcularFatorR(folha12mCents, rbt12Cents)
                : null;
            return (
              <>
                <div className="flex flex-wrap gap-2.5">
                  <CardValor
                    rotulo="RBT12"
                    valor={formatarBRL(simples.rbt12Cents)}
                    detalhe={`faixa ${simples.faixa} do anexo`}
                  />
                  <CardValor
                    rotulo="Alíquota efetiva"
                    valor={formatarPercent(simples.aliquotaEfetiva)}
                  />
                  <CardValor
                    rotulo={`DAS estimado (${rotuloMes(apuracao.mes, apuracao.ano)})`}
                    valor={formatarBRL(simples.dasEstimadoCents)}
                    detalhe={
                      receitaMes.registrada
                        ? undefined
                        : "registre a receita do mês"
                    }
                    destaque
                  />
                </div>
                {fatorR && rbt12Cents > 0 && (
                  <div
                    className="mt-2.5 rounded-2xl px-4 py-3 border"
                    style={
                      fatorR.anexoIndicado === empresa.anexoSimples
                        ? { background: "#F7F9FC", borderColor: "#E3E6EC" }
                        : { background: "#FCF1DF", borderColor: "#F5DFB8" }
                    }
                  >
                    <p className="text-[13px] font-semibold text-ink">
                      Fator R: {formatarPercent(fatorR.fatorR)} → indica o Anexo{" "}
                      {fatorR.anexoIndicado}
                      {fatorR.anexoIndicado !== empresa.anexoSimples &&
                        ` — o cadastro está como Anexo ${empresa.anexoSimples}`}
                    </p>
                    <p className="text-[12px] text-ink-muted mt-0.5">
                      Folha aproximada de 12 meses ({formatarBRL(folha12mCents)}
                      {" = "}pró-labores + salários atuais × 12) ÷ RBT12. Aumentar o
                      pró-labore pode mudar o anexo.
                    </p>
                  </div>
                )}
                {simples.acimaDoSublimite && (
                  <p className="text-[12.5px] font-semibold mt-2" style={{ color: "#B9791C" }}>
                    RBT12 acima do sublimite de R$ 3,6 mi — ICMS/ISS saem do DAS.
                    {simples.acimaDoLimite &&
                      " Acima também do limite de R$ 4,8 mi: exclusão do Simples."}
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {regime === "PRESUMIDO" && (
        <div>
          <TituloSecao>Lucro Presumido</TituloSecao>
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.keys(LABEL_ATIVIDADE_PRESUMIDO) as AtividadePresumido[]).map(
              (a) => {
                const ativa = empresa.atividadePresumido === a;
                return (
                  <button
                    key={a}
                    onClick={async () => {
                      try {
                        await definirAtividadePresumido(empresa.id, a);
                        onRecarregar();
                      } catch (e) {
                        tratarErro(e, {
                          contexto: "definir atividade",
                          mensagemUsuario: "Não foi possível salvar a atividade.",
                        });
                      }
                    }}
                    className="h-[34px] px-3.5 rounded-full font-semibold text-[13px] transition-colors"
                    style={
                      ativa
                        ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                        : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                    }
                  >
                    {LABEL_ATIVIDADE_PRESUMIDO[a]}
                  </button>
                );
              }
            )}
          </div>
          {empresa.atividadePresumido ? (
            (() => {
              const mes = calcularPresumidoMes(receitaMes.receitaCents);
              const tri = calcularPresumidoTrimestre(
                empresa.atividadePresumido,
                receitaTrimestreCents
              );
              return (
                <>
                  <div className="flex flex-wrap gap-2.5">
                    <CardValor
                      rotulo={`PIS (${rotuloMes(apuracao.mes, apuracao.ano)})`}
                      valor={formatarBRL(mes.pisCents)}
                      detalhe="0,65% da receita"
                    />
                    <CardValor
                      rotulo={`Cofins (${rotuloMes(apuracao.mes, apuracao.ano)})`}
                      valor={formatarBRL(mes.cofinsCents)}
                      detalhe="3% da receita"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2.5 mt-2.5">
                    <CardValor
                      rotulo={`IRPJ (${trimestre}º trimestre)`}
                      valor={formatarBRL(tri.irpjCents)}
                      detalhe={
                        tri.irpjAdicionalCents > 0
                          ? `inclui adicional de ${formatarBRL(tri.irpjAdicionalCents)}`
                          : `base presumida ${formatarBRL(tri.baseIrpjCents)}`
                      }
                      destaque
                    />
                    <CardValor
                      rotulo={`CSLL (${trimestre}º trimestre)`}
                      valor={formatarBRL(tri.csllCents)}
                      detalhe={`base presumida ${formatarBRL(tri.baseCsllCents)}`}
                      destaque
                    />
                    <CardValor
                      rotulo="Receita do trimestre"
                      valor={formatarBRL(tri.receitaTrimestreCents)}
                    />
                  </div>
                  <p className="text-[12px] text-ink-muted mt-2">
                    PIS/Cofins seguem até 2026 — a CBS substitui os dois a partir de
                    2027 (reforma tributária).
                  </p>
                </>
              );
            })()
          ) : (
            <p className="text-[13px] text-ink-muted">
              Selecione a atividade para calcular as presunções (8%, 16% ou 32%).
            </p>
          )}
        </div>
      )}

      {regime === "REAL" && (
        <div>
          <TituloSecao>Lucro Real</TituloSecao>
          <div className="bg-surface border rounded-2xl px-5 py-4" style={ESTILO_CARD}>
            <p className="text-[13.5px] text-ink-secondary leading-relaxed">
              No Lucro Real, IRPJ e CSLL dependem do resultado contábil (LALUR) —
              o cálculo automático não se aplica aqui. Use a agenda de{" "}
              <strong>Obrigações</strong> para acompanhar prazos e registre as
              receitas acima para manter o histórico de faturamento.
            </p>
          </div>
        </div>
      )}

      {regime === "MEI" && (
        <div>
          <TituloSecao>MEI</TituloSecao>
          <div className="flex flex-wrap gap-2.5">
            <CardValor
              rotulo="DAS-MEI fixo"
              valor={formatarBRL(MEI_INSS_CENTS)}
              detalhe={`INSS (5% do mínimo) + ${formatarBRL(MEI_ICMS_CENTS)} ICMS e/ou ${formatarBRL(MEI_ISS_CENTS)} ISS`}
              destaque
            />
            <CardValor
              rotulo={`Faturamento em ${apuracao.ano}`}
              valor={formatarBRL(receitaAnoCents)}
              detalhe={`limite anual ${formatarBRL(MEI_LIMITE_CENTS)}`}
            />
          </div>
          {receitaAnoCents > MEI_LIMITE_CENTS && (
            <p className="text-[12.5px] font-semibold mt-2" style={{ color: "#C0413B" }}>
              Faturamento acima do limite do MEI — avalie o desenquadramento para
              o Simples Nacional.
            </p>
          )}
        </div>
      )}

      {/* ── Pró-labore ────────────────────────────────────────────────────── */}
      {regime !== "MEI" && sociosComProLabore.length > 0 && (
        <div>
          <TituloSecao>Pró-labore dos sócios ({TRIBUTOS_ANO_REFERENCIA})</TituloSecao>
          <div className="flex flex-col gap-2">
            {sociosComProLabore.map((s) => {
              const calc = calcularProLabore(s.proLaboreCents, comCppPatronal);
              return (
                <div
                  key={s.vinculoId}
                  className="bg-surface border rounded-2xl px-5 py-3.5"
                  style={ESTILO_CARD}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-bold text-[14.5px] text-ink truncate">{s.nome}</p>
                    <p className="text-[13px] text-ink-secondary tabular-nums shrink-0">
                      bruto {formatarBRL(calc.brutoCents)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5 text-[12.5px] tabular-nums">
                    <span className="text-ink-secondary">
                      INSS (11%): <strong className="text-ink">{formatarBRL(calc.inssCents)}</strong>
                    </span>
                    <span className="text-ink-secondary">
                      IRRF: <strong className="text-ink">{formatarBRL(calc.irrfCents)}</strong>
                      {calc.irrfCents === 0 && calc.brutoCents <= 500_000 && (
                        <span className="text-ink-muted"> (isento até R$ 5.000)</span>
                      )}
                    </span>
                    <span className="text-ink-secondary">
                      líquido:{" "}
                      <strong style={{ color: "#0E885A" }}>
                        {formatarBRL(calc.liquidoCents)}
                      </strong>
                    </span>
                    {comCppPatronal && (
                      <span className="text-ink-secondary">
                        CPP da empresa (20%):{" "}
                        <strong className="text-ink">{formatarBRL(calc.cppEmpresaCents)}</strong>
                      </span>
                    )}
                  </div>

                  {calc.abaixoDoMinimo && (
                    <p
                      className="text-[12.5px] font-medium mt-2 pt-2 border-t"
                      style={{ color: "#B9791C", borderColor: "#F0E3C6" }}
                    >
                      Abaixo do salário mínimo ({formatarBRL(PRO_LABORE_MINIMO_CENTS)}).
                      Sócio que atua na empresa precisa retirar ao menos o piso —
                      valor menor é passível de autuação.
                    </p>
                  )}
                </div>
              );
            })}
            {!comCppPatronal && regime === "SIMPLES" && (
              <p className="text-[12px] text-ink-muted px-0.5">
                Nos Anexos I–III e V a CPP patronal já está dentro do DAS — sem os
                20% por fora (diferente do Anexo IV).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal de receita */}
      {editandoReceita && (
        <ModalReceita
          empresaId={empresa.id}
          mes={editandoReceita.mes}
          ano={editandoReceita.ano}
          valorAtual={editandoReceita.receitaCents}
          onSalvo={() => {
            setEditandoReceita(null);
            carregarReceitas();
          }}
          onFechar={() => setEditandoReceita(null)}
        />
      )}
    </div>
  );
}
