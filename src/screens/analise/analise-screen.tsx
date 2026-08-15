import { useEffect, useMemo, useState } from "react";
import { useMesStore } from "@/app/mes-store";
import { formatarMesAno } from "@/utils/dates";
import { formatarBRL, porcentagem } from "@/utils/money";
import { tratarErro } from "@/core/errors";
import {
  competenciaDoIndice,
  deslocarCompetencia,
  gastosPorCategoria,
  indiceCompetencia,
  resumoDoIntervalo,
  serieMensal,
  tamanhoDoIntervalo,
  type Competencia,
  type GastoCategoria,
  type PontoMensal,
  type ResumoAgregado,
} from "@/core/db/analise";

type Tab = "mes" | "ano" | "periodo" | "score" | "longo-prazo";

const TABS: { id: Tab; label: string }[] = [
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
  { id: "periodo", label: "Período" },
  { id: "score", label: "Score" },
  { id: "longo-prazo", label: "Longo prazo" },
];

/** Janelas oferecidas na aba Período, em meses. */
const JANELAS = [3, 6, 12] as const;
type Janela = (typeof JANELAS)[number];

/** Rótulos curtos e previsíveis — sem depender da abreviação do locale. */
const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const RESUMO_VAZIO: ResumoAgregado = {
  entrouCents: 0,
  saiuCents: 0,
  saldoCents: 0,
  total: 0,
};

// ─── Helpers de apresentação ──────────────────────────────────────────────────

/** Altura/largura da barra proporcional ao maior valor da série. */
function proporcao(valorCents: number, maiorCents: number): string {
  if (maiorCents <= 0 || valorCents <= 0) return "0%";
  // piso de 2% só para o valor não confirmado sumir visualmente
  return `${Math.max(2, (valorCents / maiorCents) * 100)}%`;
}

function rotuloPonto(p: PontoMensal, mostrarAno: boolean): string {
  const mes = MESES_CURTOS[p.mes - 1] ?? String(p.mes);
  return mostrarAno ? `${mes}/${String(p.ano).slice(-2)}` : mes;
}

function corDoSaldo(saldoCents: number): string {
  if (saldoCents > 0) return "text-positive";
  if (saldoCents < 0) return "text-negative";
  return "text-ink";
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IcoSeta({ direcao }: { direcao: "esquerda" | "direita" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direcao === "esquerda" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Navegador({
  rotulo,
  onAnterior,
  onProximo,
}: {
  rotulo: string;
  onAnterior: () => void;
  onProximo: () => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
      <button
        onClick={onAnterior}
        aria-label="Anterior"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer border-none bg-transparent"
      >
        <IcoSeta direcao="esquerda" />
      </button>
      <span className="min-w-[140px] text-center text-sm font-semibold text-ink capitalize">
        {rotulo}
      </span>
      <button
        onClick={onProximo}
        aria-label="Próximo"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer border-none bg-transparent"
      >
        <IcoSeta direcao="direita" />
      </button>
    </div>
  );
}

function CartaoKpi({
  titulo,
  valor,
  legenda,
  corValor = "text-ink",
}: {
  titulo: string;
  valor: string;
  legenda: string;
  corValor?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl px-5 py-4">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{titulo}</p>
      <p className={`text-[22px] font-bold tabular-nums mt-1 ${corValor}`}>{valor}</p>
      <p className="text-xs text-ink-muted mt-1">{legenda}</p>
    </div>
  );
}

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6 mb-4">
      <p className="text-sm font-semibold text-ink-secondary mb-4">{titulo}</p>
      {children}
    </div>
  );
}

function Vazio({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-14 text-center">
      <p className="text-sm font-medium text-ink-muted">{titulo}</p>
      {detalhe && <p className="text-xs text-ink-placeholder">{detalhe}</p>}
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex items-center gap-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <span className="w-2.5 h-2.5 rounded-full bg-positive" /> entrou
      </span>
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <span className="w-2.5 h-2.5 rounded-full bg-negative" /> saiu
      </span>
    </div>
  );
}

/** Barras verticais reais: altura proporcional ao maior valor da própria série. */
function GraficoSerie({ serie }: { serie: PontoMensal[] }) {
  const maior = serie.reduce(
    (max, p) => Math.max(max, p.entrouCents, p.saiuCents),
    0
  );
  const mostrarAno = serie.length > 0 && serie[0].ano !== serie[serie.length - 1].ano;

  if (maior === 0) {
    return (
      <Vazio
        titulo="Nenhum movimento confirmado neste intervalo."
        detalhe="Confirme lançamentos para a série mensal aparecer aqui."
      />
    );
  }

  return (
    <>
      <div className="h-44 flex items-end gap-2 border-b border-border-subtle">
        {serie.map((p) => (
          <div
            key={`${p.ano}-${p.mes}`}
            className="flex-1 h-full flex items-end justify-center gap-[3px]"
            title={`${formatarMesAno(p.mes, p.ano)} · entrou ${formatarBRL(
              p.entrouCents
            )} · saiu ${formatarBRL(p.saiuCents)}`}
          >
            <div
              className="w-1/2 max-w-[16px] rounded-t-sm bg-positive"
              style={{ height: proporcao(p.entrouCents, maior) }}
            />
            <div
              className="w-1/2 max-w-[16px] rounded-t-sm bg-negative"
              style={{ height: proporcao(p.saiuCents, maior) }}
            />
          </div>
        ))}
      </div>
      <div className="flex mt-2">
        {serie.map((p) => (
          <span
            key={`rot-${p.ano}-${p.mes}`}
            className="text-2xs text-ink-muted flex-1 text-center"
          >
            {rotuloPonto(p, mostrarAno)}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <Legenda />
      </div>
    </>
  );
}

/** Barras horizontais de gasto por categoria, na cor da própria categoria. */
function GraficoCategorias({ gastos }: { gastos: GastoCategoria[] }) {
  if (gastos.length === 0) {
    return (
      <Vazio
        titulo="Nenhum gasto confirmado neste intervalo."
        detalhe="As saídas confirmadas aparecem aqui divididas por categoria."
      />
    );
  }

  const maior = gastos[0].totalCents;
  const total = gastos.reduce((soma, g) => soma + g.totalCents, 0);

  return (
    <div className="space-y-3.5">
      {gastos.map((g) => (
        <div key={g.id ?? "__sem_categoria__"}>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-none"
                style={{ background: g.cor }}
              />
              <span className="text-sm font-medium text-ink truncate">{g.nome}</span>
              <span className="text-2xs text-ink-placeholder flex-none">
                {g.lancamentos} {g.lancamentos === 1 ? "lançamento" : "lançamentos"}
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-none">
              <span className="text-sm font-semibold text-ink tabular-nums">
                {formatarBRL(g.totalCents)}
              </span>
              <span className="text-xs text-ink-muted tabular-nums">
                {porcentagem(g.totalCents, total).toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-border-subtle overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: proporcao(g.totalCents, maior), background: g.cor }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeituraIA() {
  return (
    <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
        <span className="text-sm font-semibold text-brand">Leitura da IA</span>
      </div>
      <p className="text-sm text-ink-secondary leading-relaxed">
        Configure uma IA nas integrações do perfil para receber análises personalizadas sobre seus gastos e receitas.
      </p>
    </div>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function AnaliseScreen() {
  const [tab, setTab] = useState<Tab>("mes");
  const { mes, ano, irParaMesAnterior, irParaProximoMes } = useMesStore();

  // Aba Ano tem seu próprio cursor: navegar por ano não deve mexer na
  // competência global (compartilhada com Mês e Lançamentos).
  const [anoSel, setAnoSel] = useState(ano);
  const [janela, setJanela] = useState<Janela>(6);

  const [resumo, setResumo] = useState<ResumoAgregado>(RESUMO_VAZIO);
  const [resumoAnterior, setResumoAnterior] = useState<ResumoAgregado>(RESUMO_VAZIO);
  const [serie, setSerie] = useState<PontoMensal[]>([]);
  const [gastos, setGastos] = useState<GastoCategoria[]>([]);
  const [carregando, setCarregando] = useState(true);

  const analitica = tab === "mes" || tab === "ano" || tab === "periodo";

  /** Intervalo de competências que cada aba analisa. */
  const intervalo = useMemo<{ inicio: Competencia; fim: Competencia } | null>(() => {
    if (tab === "mes") return { inicio: { mes, ano }, fim: { mes, ano } };
    if (tab === "ano") {
      return { inicio: { mes: 1, ano: anoSel }, fim: { mes: 12, ano: anoSel } };
    }
    if (tab === "periodo") {
      const fim = { mes, ano };
      return { inicio: deslocarCompetencia(fim, -(janela - 1)), fim };
    }
    return null;
  }, [tab, mes, ano, anoSel, janela]);

  useEffect(() => {
    if (!intervalo) return;
    const { inicio, fim } = intervalo;

    // Intervalo imediatamente anterior, do mesmo tamanho — é a base honesta
    // para o "vs." do cartão de sobra.
    const meses = tamanhoDoIntervalo(inicio, fim);
    const fimAnterior = deslocarCompetencia(inicio, -1);
    const inicioAnterior = competenciaDoIndice(
      indiceCompetencia(fimAnterior) - (meses - 1)
    );

    let ativo = true;
    setCarregando(true);

    Promise.all([
      resumoDoIntervalo(inicio, fim),
      resumoDoIntervalo(inicioAnterior, fimAnterior),
      serieMensal(inicio, fim),
      gastosPorCategoria(inicio, fim),
    ])
      .then(([r, rAnt, s, g]) => {
        if (!ativo) return;
        setResumo(r);
        setResumoAnterior(rAnt);
        setSerie(s);
        setGastos(g);
      })
      .catch((e) => {
        if (!ativo) return;
        setResumo(RESUMO_VAZIO);
        setResumoAnterior(RESUMO_VAZIO);
        setSerie([]);
        setGastos([]);
        tratarErro(e, {
          contexto: "carregar análise",
          mensagemUsuario: "Não foi possível carregar a análise.",
        });
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [intervalo]);

  // ── Rótulos derivados ───────────────────────────────────────────────────────

  const rotuloIntervalo = useMemo(() => {
    if (!intervalo) return "—";
    if (tab === "mes") return formatarMesAno(mes, ano);
    if (tab === "ano") return String(anoSel);
    const { inicio, fim } = intervalo;
    return `${MESES_CURTOS[inicio.mes - 1]}/${String(inicio.ano).slice(-2)} — ${
      MESES_CURTOS[fim.mes - 1]
    }/${String(fim.ano).slice(-2)}`;
  }, [intervalo, tab, mes, ano, anoSel]);

  /** Comparação com o intervalo anterior — só quando existe base real. */
  const comparativo = useMemo(() => {
    if (carregando) return "—";
    if (resumoAnterior.total === 0) return "sem base de comparação";
    const delta = resumo.saldoCents - resumoAnterior.saldoCents;
    if (delta === 0) return "igual ao intervalo anterior";
    const sinal = delta > 0 ? "+" : "−";
    return `${sinal} ${formatarBRL(Math.abs(delta))} vs. intervalo anterior`;
  }, [carregando, resumo, resumoAnterior]);

  const semDados = !carregando && resumo.total === 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              "h-8 px-4 rounded-lg text-sm font-semibold transition-all",
              tab === id
                ? "bg-brand text-white shadow-xs"
                : "text-ink-secondary hover:text-ink",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {!analitica ? (
        <div className="bg-surface border border-border rounded-xl p-6">
          <Vazio
            titulo={
              tab === "score"
                ? "O score financeiro ainda não está pronto."
                : "A projeção de longo prazo ainda não está pronta."
            }
            detalhe="Em breve. Enquanto isso, as abas Mês, Ano e Período já mostram os números reais."
          />
        </div>
      ) : (
        <>
          {/* Controles do intervalo */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {tab === "mes" && (
              <Navegador
                rotulo={formatarMesAno(mes, ano)}
                onAnterior={irParaMesAnterior}
                onProximo={irParaProximoMes}
              />
            )}

            {tab === "ano" && (
              <Navegador
                rotulo={String(anoSel)}
                onAnterior={() => setAnoSel((a) => a - 1)}
                onProximo={() => setAnoSel((a) => a + 1)}
              />
            )}

            {tab === "periodo" && (
              <>
                <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
                  {JANELAS.map((j) => (
                    <button
                      key={j}
                      onClick={() => setJanela(j)}
                      className={[
                        "h-8 px-3.5 rounded-lg text-sm font-semibold transition-all",
                        janela === j
                          ? "bg-brand text-white shadow-xs"
                          : "text-ink-secondary hover:text-ink",
                      ].join(" ")}
                    >
                      {j} meses
                    </button>
                  ))}
                </div>
                <Navegador
                  rotulo={formatarMesAno(mes, ano)}
                  onAnterior={irParaMesAnterior}
                  onProximo={irParaProximoMes}
                />
                <span className="text-xs text-ink-muted">
                  até a competência selecionada
                </span>
              </>
            )}
          </div>

          {semDados ? (
            <div className="bg-surface border border-border rounded-xl p-6 mb-4">
              <Vazio
                titulo={`Nenhum movimento confirmado em ${rotuloIntervalo}.`}
                detalhe="Só entram na análise lançamentos reais com status confirmado ou pago."
              />
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <CartaoKpi
                  titulo="sobra"
                  valor={carregando ? "R$ —" : formatarBRL(resumo.saldoCents)}
                  corValor={carregando ? "text-ink" : corDoSaldo(resumo.saldoCents)}
                  legenda={comparativo}
                />
                <CartaoKpi
                  titulo="entrou"
                  valor={carregando ? "R$ —" : formatarBRL(resumo.entrouCents)}
                  legenda={rotuloIntervalo}
                />
                <CartaoKpi
                  titulo="saiu"
                  valor={carregando ? "R$ —" : formatarBRL(resumo.saiuCents)}
                  legenda={rotuloIntervalo}
                />
              </div>

              {carregando ? (
                <div className="bg-surface border border-border rounded-xl p-6 mb-4">
                  <div className="h-4 w-40 bg-border-subtle rounded animate-pulse" />
                  <div className="h-40 w-full bg-border-subtle rounded animate-pulse mt-4" />
                </div>
              ) : (
                <>
                  {/* Série mensal — só faz sentido com mais de uma competência */}
                  {tab !== "mes" && (
                    <Painel titulo="Entrou e saiu, mês a mês">
                      <GraficoSerie serie={serie} />
                    </Painel>
                  )}

                  <Painel titulo="Gastos por categoria">
                    <GraficoCategorias gastos={gastos} />
                  </Painel>
                </>
              )}
            </>
          )}

          <LeituraIA />
        </>
      )}
    </div>
  );
}
