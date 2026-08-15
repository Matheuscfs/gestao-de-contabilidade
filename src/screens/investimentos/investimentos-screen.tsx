import { useEffect, useMemo, useState } from "react";
import { formatarBRL } from "@/utils/money";
import { tratarErro } from "@/core/errors";
import {
  listarInvestimentos,
  rendimentoInvestimento,
  rentabilidadeInvestimento,
  saldoInvestimento,
  type Investimento,
} from "@/core/db/investimentos";

// ─── Constantes de apresentação ────────────────────────────────────────────────

const SUB_TIPOS: Record<string, { label: string; cor: string; tint: string }> = {
  FIXED_INCOME: { label: "Renda fixa", cor: "#1E4BA3", tint: "#DBEAFE" },
  STOCK: { label: "Ações", cor: "#12A06B", tint: "#E2F4EC" },
  ETF: { label: "ETF", cor: "#0891B2", tint: "#E0F2FE" },
  PENSION: { label: "Previdência", cor: "#9333EA", tint: "#F3E8FF" },
  OTHER: { label: "Outros", cor: "#5B616E", tint: "#F0F2F6" },
};

function infoSubTipo(s: string | null) {
  if (!s) return SUB_TIPOS.OTHER;
  return SUB_TIPOS[s] ?? { label: s, cor: "#5B616E", tint: "#F0F2F6" };
}

const GRID = "minmax(0,1fr) 130px 130px 150px 44px";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "+ 12,34%" / "− 3,10%" / "—" quando não há base de cálculo. */
function formatarRentabilidade(pct: number | null): string {
  if (pct == null) return "—";
  const sinal = pct > 0 ? "+ " : pct < 0 ? "− " : "";
  return `${sinal}${Math.abs(pct).toFixed(2).replace(".", ",")}%`;
}

function corDoValor(cents: number): string {
  if (cents > 0) return "#12A06B";
  if (cents < 0) return "#D74A45";
  return "#5B616E";
}

/** Linha de apoio abaixo do nome: ticker, quantidade e corretora. */
function detalhe(i: Investimento): string | null {
  const partes: string[] = [];
  if (i.ticker) partes.push(i.ticker);
  if (i.quantidade != null && i.quantidade !== 1) {
    partes.push(`${i.quantidade} cotas`);
  }
  if (i.corretora) partes.push(i.corretora);
  if (partes.length === 0 && i.source === "PLUGGY") partes.push("Banco (Pluggy)");
  return partes.length > 0 ? partes.join(" · ") : null;
}

// ─── Ícone ─────────────────────────────────────────────────────────────────────

function IconeInvestimento({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function Avatar({ i }: { i: Investimento }) {
  const t = infoSubTipo(i.subTipo);
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: t.tint, color: t.cor }}
    >
      <IconeInvestimento />
    </div>
  );
}

function Chip({ label, cor, tint }: { label: string; cor: string; tint: string }) {
  return (
    <span
      className="inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: tint, color: cor }}
    >
      {label}
    </span>
  );
}

// ─── Tela ──────────────────────────────────────────────────────────────────────

export function InvestimentosScreen() {
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setInvestimentos(await listarInvestimentos());
      } catch (e) {
        tratarErro(e, {
          contexto: "carregar investimentos",
          mensagemUsuario: "Não foi possível carregar os investimentos.",
        });
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    let patrimonio = 0;
    let rendimento = 0;
    for (const i of investimentos) {
      patrimonio += saldoInvestimento(i);
      rendimento += rendimentoInvestimento(i);
    }
    return { patrimonio, rendimento, ativas: investimentos.length };
  }, [investimentos]);

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">patrimônio total</p>
          <p className="text-[22px] font-bold text-positive tabular-nums mt-1">
            {carregando ? "R$ —" : formatarBRL(stats.patrimonio)}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">rendimento mês</p>
          <p
            className="text-[22px] font-bold tabular-nums mt-1"
            style={{ color: carregando ? undefined : corDoValor(stats.rendimento) }}
          >
            {carregando
              ? "R$ —"
              : `${stats.rendimento >= 0 ? "+" : "−"} ${formatarBRL(Math.abs(stats.rendimento))}`}
          </p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">aplicações ativas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : stats.ativas}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div
          className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center"
          style={{ gridTemplateColumns: GRID }}
        >
          <span className="text-xs font-semibold text-ink-muted">Investimento</span>
          <span className="text-xs font-semibold text-ink-muted">Tipo</span>
          <span className="text-xs font-semibold text-ink-muted">Rentabilidade</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Saldo</span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : investimentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-1">
            <p className="text-sm font-medium text-ink-muted">
              Nenhum investimento cadastrado ainda.
            </p>
            <p className="text-xs text-ink-placeholder">
              Sincronize um banco para trazer a carteira automaticamente.
            </p>
          </div>
        ) : (
          investimentos.map((i, idx) => {
            const t = infoSubTipo(i.subTipo);
            const rendimento = rendimentoInvestimento(i);
            const pct = rentabilidadeInvestimento(i);
            const linhaDetalhe = detalhe(i);
            return (
              <div key={i.id}>
                <div className="grid px-5 py-3 items-center" style={{ gridTemplateColumns: GRID }}>
                  {/* Investimento */}
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <Avatar i={i} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">
                        {i.description}
                      </p>
                      <p className="text-[12px] text-ink-muted mt-0.5 truncate">
                        {linhaDetalhe ?? `aplicado ${formatarBRL(i.aplicadoCents)}`}
                      </p>
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="pr-3">
                    <Chip label={t.label} cor={t.cor} tint={t.tint} />
                  </div>

                  {/* Rentabilidade */}
                  <div className="pr-3">
                    <p
                      className="text-[14px] font-semibold tabular-nums"
                      style={{ color: corDoValor(rendimento) }}
                    >
                      {formatarRentabilidade(pct)}
                    </p>
                    <p className="text-[12px] tabular-nums text-ink-muted mt-0.5">
                      {rendimento === 0
                        ? "sem variação"
                        : `${rendimento > 0 ? "+" : "−"} ${formatarBRL(Math.abs(rendimento))}`}
                    </p>
                  </div>

                  {/* Saldo */}
                  <span className="text-[14px] font-semibold text-ink tabular-nums text-right">
                    {formatarBRL(saldoInvestimento(i))}
                  </span>

                  <span />
                </div>
                {idx < investimentos.length - 1 && (
                  <div className="h-px bg-border-subtle mx-5" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
