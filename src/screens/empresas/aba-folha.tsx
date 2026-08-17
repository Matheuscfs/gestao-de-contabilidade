/**
 * Aba Folha — competência mensal de salários e pró-labore.
 *
 * A competência nasce pré-preenchida com quem estava ativo no mês e os valores
 * já calculados. Fechar a competência é o gesto que a transforma em histórico:
 * é a folha fechada que alimenta o Fator R.
 *
 * O que esta tela mostra e a antiga estimativa não mostrava: o custo do
 * empregador. FGTS, CPP, RAT ajustado pelo FAP e terceiros aparecem separados,
 * porque juntos passam de 35% da folha no Lucro Presumido.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import type { Empresa } from "@/core/db/empresas";
import {
  definirParametrosEncargo,
  definirStatusFolha,
  obterOuCriarFolha,
  salvarItemFolha,
  type EmpresaParaFolha,
  type FolhaCompetencia,
  type ItemFolha,
} from "@/core/db/folha";
import {
  cppForaDoDas,
  deveTerceiros,
  ratAjustadoCentesimos,
  FAP_MAXIMO_DECIMILESIMOS,
  FAP_MINIMO_DECIMILESIMOS,
  RAT_OPCOES,
} from "@/consts/folha";
import { formatarBRL } from "@/utils/money";
import { mesAnterior, mesAnoAtual } from "@/utils/dates";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ESTILO_CARD = { borderColor: "#E3E6EC" };

function pct(centesimos: number): string {
  return `${(centesimos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function empresaParaFolha(e: Empresa): EmpresaParaFolha {
  return {
    id: e.id,
    regimeTributario: e.regimeTributario,
    anexoSimples: e.anexoSimples,
    ratCentesimos: e.ratCentesimos,
    fapDecimilesimos: e.fapDecimilesimos,
    terceirosCentesimos: e.terceirosCentesimos,
  };
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function LinhaItem({
  item,
  bloqueada,
  onSalvar,
}: {
  item: ItemFolha;
  bloqueada: boolean;
  onSalvar: (dados: {
    baseCents: number;
    decimoTerceiroCents: number;
    tercoFeriasCents: number;
    outrosDescontosCents: number;
    dependentes: number;
  }) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [base, setBase] = useState(item.baseCents);
  const [decimo, setDecimo] = useState(item.decimoTerceiroCents);
  const [terco, setTerco] = useState(item.tercoFeriasCents);
  const [descontos, setDescontos] = useState(item.outrosDescontosCents);
  const [dependentes, setDependentes] = useState(item.dependentes);
  const [salvando, setSalvando] = useState(false);

  const sujo =
    base !== item.baseCents ||
    decimo !== item.decimoTerceiroCents ||
    terco !== item.tercoFeriasCents ||
    descontos !== item.outrosDescontosCents ||
    dependentes !== item.dependentes;

  return (
    <div className="bg-surface border rounded-2xl px-5 py-3.5" style={ESTILO_CARD}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[14.5px] text-ink truncate">{item.nome}</p>
            <span
              className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
              style={
                item.tipo === "PRO_LABORE"
                  ? { background: "#F3EEFB", color: "#6D4AA8" }
                  : { background: "#E2F4EC", color: "#0E885A" }
              }
            >
              {item.tipo === "PRO_LABORE" ? "PRÓ-LABORE" : "CLT"}
            </span>
          </div>
          <p className="text-[12px] text-ink-secondary tabular-nums mt-0.5">
            bruto {formatarBRL(item.proventosCents)} · descontos{" "}
            {formatarBRL(item.descontosCents)} · encargos{" "}
            {formatarBRL(item.encargosCents)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-[15px] tabular-nums" style={{ color: "#0E885A" }}>
            {formatarBRL(item.liquidoCents)}
          </p>
          <p className="text-[11px] text-ink-muted">líquido</p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A909B"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="mt-3 pt-3 border-t border-border-subtle flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[12px] font-semibold text-ink-secondary mb-1">
                {item.tipo === "PRO_LABORE" ? "Retirada do mês" : "Salário do mês"}
              </span>
              <MoneyInput
                centavos={base}
                onChange={setBase}
                aria-label={`Base de ${item.nome}`}
              />
            </label>
            {item.tipo === "SALARIO" && (
              <label className="block">
                <span className="block text-[12px] font-semibold text-ink-secondary mb-1">
                  13º salário
                </span>
                <MoneyInput
                  centavos={decimo}
                  onChange={setDecimo}
                  aria-label={`13º de ${item.nome}`}
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {item.tipo === "SALARIO" && (
              <label className="block">
                <span className="block text-[12px] font-semibold text-ink-secondary mb-1">
                  Terço de férias
                </span>
                <MoneyInput
                  centavos={terco}
                  onChange={setTerco}
                  aria-label={`Terço de férias de ${item.nome}`}
                />
              </label>
            )}
            <label className="block">
              <span className="block text-[12px] font-semibold text-ink-secondary mb-1">
                Outros descontos
              </span>
              <MoneyInput
                centavos={descontos}
                onChange={setDescontos}
                aria-label={`Outros descontos de ${item.nome}`}
              />
            </label>
          </div>

          <label className="block max-w-[160px]">
            <span className="block text-[12px] font-semibold text-ink-secondary mb-1">
              Dependentes (IRRF)
            </span>
            <span
              className="flex items-center h-[46px] px-4 bg-surface rounded-xl"
              style={{ border: "1px solid #D4D8E0" }}
            >
              <input
                value={dependentes}
                onChange={(e) =>
                  setDependentes(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))
                }
                inputMode="numeric"
                className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium tabular-nums text-ink font-sans"
              />
            </span>
          </label>

          {/* Composição calculada */}
          <div
            className="rounded-xl px-4 py-3 text-[12.5px] tabular-nums flex flex-wrap gap-x-5 gap-y-1"
            style={{ background: "#F7F8FA" }}
          >
            <span className="text-ink-secondary">
              INSS <strong className="text-ink">{formatarBRL(item.inssCents)}</strong>
            </span>
            <span className="text-ink-secondary">
              IRRF <strong className="text-ink">{formatarBRL(item.irrfCents)}</strong>
            </span>
            {item.fgtsCents > 0 && (
              <span className="text-ink-secondary">
                FGTS <strong className="text-ink">{formatarBRL(item.fgtsCents)}</strong>
              </span>
            )}
            {item.cppCents > 0 && (
              <span className="text-ink-secondary">
                CPP <strong className="text-ink">{formatarBRL(item.cppCents)}</strong>
              </span>
            )}
            {item.ratCents > 0 && (
              <span className="text-ink-secondary">
                RAT <strong className="text-ink">{formatarBRL(item.ratCents)}</strong>
              </span>
            )}
            {item.terceirosCents > 0 && (
              <span className="text-ink-secondary">
                Terceiros{" "}
                <strong className="text-ink">{formatarBRL(item.terceirosCents)}</strong>
              </span>
            )}
          </div>

          {!bloqueada && sujo && (
            <button
              disabled={salvando}
              onClick={async () => {
                setSalvando(true);
                try {
                  await onSalvar({
                    baseCents: base,
                    decimoTerceiroCents: decimo,
                    tercoFeriasCents: terco,
                    outrosDescontosCents: descontos,
                    dependentes,
                  });
                } finally {
                  setSalvando(false);
                }
              }}
              className="self-start h-[38px] px-4 rounded-full text-white font-semibold text-[13.5px] disabled:opacity-50 transition-opacity"
              style={{ background: "#4078E6" }}
            >
              {salvando ? "Salvando…" : "Salvar e recalcular"}
            </button>
          )}
          {bloqueada && (
            <p className="text-[12px] text-ink-muted">
              Competência fechada — reabra para editar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Aba ──────────────────────────────────────────────────────────────────────

export function AbaFolha({
  empresa,
  onRecarregar,
}: {
  empresa: Empresa;
  onRecarregar: () => void;
}) {
  const atual = mesAnoAtual();
  const inicial = useMemo(() => mesAnterior(atual.mes, atual.ano), [atual.mes, atual.ano]);

  const [mes, setMes] = useState(inicial.mes);
  const [ano, setAno] = useState(inicial.ano);
  const [folha, setFolha] = useState<FolhaCompetencia | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [rat, setRat] = useState(empresa.ratCentesimos);
  const [fap, setFap] = useState(empresa.fapDecimilesimos);
  const [terceiros, setTerceiros] = useState(empresa.terceirosCentesimos);

  const fora = cppForaDoDas(empresa.regimeTributario, empresa.anexoSimples);
  const comTerceiros = deveTerceiros(empresa.regimeTributario);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setFolha(await obterOuCriarFolha(empresaParaFolha(empresa), mes, ano));
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar folha",
        mensagemUsuario: "Não foi possível abrir a folha da competência.",
      });
    } finally {
      setCarregando(false);
    }
  }, [empresa, mes, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function trocar(delta: number) {
    const base = new Date(ano, mes - 1 + delta, 1);
    setMes(base.getMonth() + 1);
    setAno(base.getFullYear());
  }

  const bloqueada = folha?.status === "FECHADA";

  return (
    <div className="flex flex-col gap-4">
      {/* Competência */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => trocar(-1)}
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
          onClick={() => trocar(1)}
          aria-label="Próxima competência"
          className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-ink-secondary hover:bg-surface-subtle transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {folha && (
          <span
            className="inline-flex items-center h-[24px] px-2.5 rounded-full text-[11.5px] font-bold ml-1"
            style={
              bloqueada
                ? { background: "#E2F4EC", color: "#0E885A" }
                : { background: "#FCF1DF", color: "#B9791C" }
            }
          >
            {bloqueada ? "fechada" : "aberta"}
          </span>
        )}

        {folha && folha.itens.length > 0 && (
          <button
            onClick={async () => {
              try {
                await definirStatusFolha(folha.id, bloqueada ? "ABERTA" : "FECHADA");
                toast.sucesso(bloqueada ? "Competência reaberta" : "Competência fechada");
                await carregar();
                onRecarregar();
              } catch (e) {
                tratarErro(e, {
                  contexto: "fechar folha",
                  mensagemUsuario: "Não foi possível mudar o status da folha.",
                });
              }
            }}
            className="ml-auto h-[34px] px-4 rounded-full font-semibold text-[13.5px] transition-opacity hover:opacity-85"
            style={
              bloqueada
                ? { border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }
                : { background: "#4078E6", color: "#fff", border: "none" }
            }
          >
            {bloqueada ? "Reabrir" : "Fechar competência"}
          </button>
        )}
      </div>

      {/* Parâmetros de encargo */}
      {fora && (
        <div className="bg-surface border rounded-2xl px-5 py-4" style={ESTILO_CARD}>
          <p className="text-[13px] font-semibold text-ink-secondary mb-2.5">
            Encargos por fora do DAS · RAT ajustado{" "}
            {pct(ratAjustadoCentesimos(rat, fap))}
            {comTerceiros ? ` · terceiros ${pct(terceiros)}` : " · isento de terceiros"}
          </p>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-[12px] font-semibold text-ink-secondary mb-1">
                Grau de risco (RAT)
              </p>
              <div className="flex gap-1.5">
                {RAT_OPCOES.map((o) => (
                  <button
                    key={o.centesimos}
                    onClick={() => setRat(o.centesimos)}
                    className="h-[34px] px-3 rounded-full font-semibold text-[13px] transition-colors"
                    style={
                      rat === o.centesimos
                        ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                        : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="block text-[12px] font-semibold text-ink-secondary mb-1">
                FAP (0,5000 a 2,0000)
              </span>
              <span
                className="flex items-center h-[34px] px-3 rounded-xl bg-surface"
                style={{ border: "1px solid #D4D8E0" }}
              >
                <input
                  value={(fap / 10_000).toFixed(4)}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (!Number.isFinite(n)) return;
                    setFap(
                      Math.min(
                        FAP_MAXIMO_DECIMILESIMOS,
                        Math.max(FAP_MINIMO_DECIMILESIMOS, Math.round(n * 10_000))
                      )
                    );
                  }}
                  inputMode="decimal"
                  className="w-[80px] border-none outline-none bg-transparent text-[14px] font-medium tabular-nums text-ink font-sans"
                />
              </span>
            </label>

            {comTerceiros && (
              <label className="block">
                <span className="block text-[12px] font-semibold text-ink-secondary mb-1">
                  Terceiros (%)
                </span>
                <span
                  className="flex items-center h-[34px] px-3 rounded-xl bg-surface"
                  style={{ border: "1px solid #D4D8E0" }}
                >
                  <input
                    value={(terceiros / 100).toFixed(2)}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(",", "."));
                      if (!Number.isFinite(n)) return;
                      setTerceiros(Math.min(1000, Math.max(0, Math.round(n * 100))));
                    }}
                    inputMode="decimal"
                    className="w-[70px] border-none outline-none bg-transparent text-[14px] font-medium tabular-nums text-ink font-sans"
                  />
                </span>
              </label>
            )}

            {(rat !== empresa.ratCentesimos ||
              fap !== empresa.fapDecimilesimos ||
              terceiros !== empresa.terceirosCentesimos) && (
              <button
                onClick={async () => {
                  try {
                    await definirParametrosEncargo(empresa.id, rat, fap, terceiros);
                    toast.sucesso("Parâmetros salvos — reabra a competência para recalcular");
                    onRecarregar();
                  } catch (e) {
                    tratarErro(e, {
                      contexto: "salvar parâmetros de encargo",
                      mensagemUsuario: "Não foi possível salvar.",
                    });
                  }
                }}
                className="h-[34px] px-4 rounded-full text-white font-semibold text-[13px]"
                style={{ background: "#4078E6" }}
              >
                Salvar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Itens */}
      {carregando ? (
        <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
          Carregando…
        </div>
      ) : !folha || folha.itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <p className="text-sm font-medium text-ink-muted">
            Ninguém na folha desta competência.
          </p>
          <p className="text-[12.5px] text-ink-muted max-w-[420px] text-center">
            A folha nasce de quem estava ativo no mês: funcionários cadastrados
            na aba Funcionários e sócios com pró-labore na aba Sócios.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            {folha.itens.map((item) => (
              <LinhaItem
                key={item.id}
                item={item}
                bloqueada={bloqueada}
                onSalvar={async (dados) => {
                  try {
                    await salvarItemFolha(
                      item.id,
                      {
                        baseCents: dados.baseCents,
                        decimoTerceiroCents: dados.decimoTerceiroCents,
                        feriasCents: item.feriasCents,
                        tercoFeriasCents: dados.tercoFeriasCents,
                        outrosProventosCents: item.outrosProventosCents,
                        outrosDescontosCents: dados.outrosDescontosCents,
                        dependentes: dados.dependentes,
                      },
                      empresaParaFolha(empresa)
                    );
                    toast.sucesso(`${item.nome} recalculado`);
                    await carregar();
                  } catch (e) {
                    tratarErro(e, {
                      contexto: "salvar item da folha",
                      mensagemUsuario: "Não foi possível salvar o item.",
                    });
                  }
                }}
              />
            ))}
          </div>

          {/* Totais */}
          <div
            className="rounded-2xl px-5 py-4 flex flex-wrap gap-x-8 gap-y-2"
            style={{ background: "#EAF1FD", border: "1px solid #C7DBFA" }}
          >
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "#2F63C9" }}>
                Bruto
              </p>
              <p className="font-bold text-[18px] tabular-nums text-ink">
                {formatarBRL(folha.totalProventosCents)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "#2F63C9" }}>
                Líquido a pagar
              </p>
              <p className="font-bold text-[18px] tabular-nums" style={{ color: "#0E885A" }}>
                {formatarBRL(folha.totalLiquidoCents)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "#2F63C9" }}>
                Encargos da empresa
              </p>
              <p className="font-bold text-[18px] tabular-nums text-ink">
                {formatarBRL(folha.totalEncargosCents)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "#2F63C9" }}>
                Custo total
              </p>
              <p className="font-bold text-[18px] tabular-nums text-ink">
                {formatarBRL(folha.custoTotalCents)}
              </p>
            </div>
          </div>

          <p className="text-[12px] text-ink-muted px-0.5">
            13º e férias entram na base do mês para INSS e IRRF. Na folha oficial
            o 13º tem tributação exclusiva e as férias têm competência própria —
            o número aqui serve para custo e Fator R, não para emitir holerite.
          </p>
        </>
      )}
    </div>
  );
}
