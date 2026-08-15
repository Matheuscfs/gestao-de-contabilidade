import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useMesStore } from "@/app/mes-store";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import { formatarBRL } from "@/utils/money";
import { formatarData, formatarMesAno } from "@/utils/dates";
import {
  listarLancamentosDoMes,
  confirmarLancamento,
  type LancamentoPendente,
} from "@/core/db/lancamentos";

const POP = { type: "spring", stiffness: 500, damping: 16 } as const;

// ─── Constantes de apresentação ────────────────────────────────────────────────

type Direcao = "entrada" | "saida";

const TIPOS: Record<string, { label: string; dir: Direcao }> = {
  INCOME: { label: "Receita", dir: "entrada" },
  SALARY: { label: "Salário", dir: "entrada" },
  EXPENSE: { label: "Despesa", dir: "saida" },
  INVOICE: { label: "Fatura", dir: "saida" },
  LIVING_COST: { label: "Custo de vida", dir: "saida" },
  DEBT: { label: "Dívida", dir: "saida" },
  DEBT_INSTALLMENT: { label: "Parcela", dir: "saida" },
  TRANSFER: { label: "Transferência", dir: "saida" },
  INVESTMENT: { label: "Investimento", dir: "saida" },
};

function infoTipo(t: string) {
  return TIPOS[t] ?? { label: t, dir: "saida" as Direcao };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "entra · Nubank" / "sai · vence em 12 de julho" — o contexto de cada item. */
function legenda(l: LancamentoPendente): string {
  const dir = infoTipo(l.type).dir;
  const partes: string[] = [dir === "entrada" ? "entra" : "sai"];

  if (l.dueDate) partes.push(`vence em ${formatarData(l.dueDate)}`);
  else if (l.date) partes.push(formatarData(l.date));

  const origem = l.cardName || l.accountName || l.categoryName;
  if (origem) partes.push(origem);

  return partes.join(" · ");
}

// ─── Ícones ────────────────────────────────────────────────────────────────────

function IconeTipo({ type }: { type: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "INCOME":
    case "SALARY":
      return (
        <svg {...props}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case "INVOICE":
      return (
        <svg {...props}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
    case "DEBT":
    case "DEBT_INSTALLMENT":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
  }
}

function IconeCheck({ girando }: { girando: boolean }) {
  if (girando) {
    return (
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ─── Tela ──────────────────────────────────────────────────────────────────────

export function LancamentosScreen() {
  const { mes, ano } = useMesStore();
  const [lancamentos, setLancamentos] = useState<LancamentoPendente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLancamentos(await listarLancamentosDoMes(mes, ano));
    } catch (e) {
      setLancamentos([]);
      tratarErro(e, {
        contexto: "carregar lançamentos do mês",
        mensagemUsuario: "Não foi possível carregar os lançamentos.",
      });
    } finally {
      setCarregando(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    setCarregando(true);
    void carregar();
  }, [carregar]);

  async function confirmar(l: LancamentoPendente) {
    setConfirmando(l.id);
    try {
      await confirmarLancamento(l.id);
      toast.sucesso(`"${l.description}" confirmado`);
      await carregar();
    } catch (e) {
      tratarErro(e, {
        contexto: "confirmar lançamento",
        mensagemUsuario: "Não foi possível confirmar o lançamento.",
      });
    } finally {
      setConfirmando(null);
    }
  }

  const totais = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const l of lancamentos) {
      if (infoTipo(l.type).dir === "entrada") entradas += l.amountCents;
      else saidas += l.amountCents;
    }
    return { entradas, saidas };
  }, [lancamentos]);

  const pendentes = lancamentos.length;

  return (
    <div className="animate-fade-in">
      <div className="max-w-[680px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[28px] font-bold text-ink tracking-tight">
            {carregando || pendentes > 0 ? "Bora confirmar?" : "Tudo em dia!"}
          </h1>
          <p className="text-[15px] text-ink-secondary mt-1.5">
            {carregando
              ? "Buscando o que falta confirmar…"
              : pendentes > 0
                ? `Toque no círculo pra confirmar cada item do mês. ${pendentes} ${
                    pendentes === 1 ? "pendente" : "pendentes"
                  } em ${formatarMesAno(mes, ano)}.`
                : `Nada pendente em ${formatarMesAno(mes, ano)}.`}
          </p>
        </div>

        {!carregando && pendentes > 0 && (
          <div className="flex border border-border rounded-xl overflow-hidden mb-4 bg-surface">
            <div className="flex-1 px-5 py-4 border-r border-border-subtle">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">a entrar</p>
              <p className="text-[22px] font-bold text-positive tabular-nums mt-1">
                + {formatarBRL(totais.entradas)}
              </p>
            </div>
            <div className="flex-1 px-5 py-4">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">a sair</p>
              <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
                − {formatarBRL(totais.saidas)}
              </p>
            </div>
          </div>
        )}

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {carregando ? (
            <div className="px-5 py-12 text-sm text-ink-muted text-center">Carregando…</div>
          ) : pendentes === 0 ? (
            <div className="px-5 py-4 text-sm text-ink-muted text-center">
              Nenhum lançamento pendente para confirmar.
            </div>
          ) : (
            lancamentos.map((l, i) => {
              const dir = infoTipo(l.type).dir;
              const entrada = dir === "entrada";
              const ocupado = confirmando === l.id;
              return (
                <div
                  key={l.id}
                  className={[
                    "flex items-center gap-3.5 px-5 py-4",
                    i < lancamentos.length - 1 ? "border-b border-border-subtle" : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      entrada
                        ? "bg-positive-50 text-positive"
                        : "bg-surface-subtle text-ink-secondary",
                    ].join(" ")}
                  >
                    <IconeTipo type={l.type} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-ink truncate">
                      {l.description}
                    </p>
                    <p className="text-[13px] text-ink-secondary mt-0.5 truncate">
                      {legenda(l)}
                    </p>
                  </div>

                  <span
                    className={[
                      "text-base font-semibold tabular-nums mr-3.5 shrink-0",
                      entrada ? "text-positive" : "text-ink",
                    ].join(" ")}
                  >
                    {entrada ? "+" : "−"} {formatarBRL(l.amountCents)}
                  </span>

                  <motion.button
                    aria-label={`Confirmar ${l.description}`}
                    onClick={() => void confirmar(l)}
                    disabled={ocupado}
                    className="w-[46px] h-[46px] rounded-full border-2 border-brand text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={ocupado ? undefined : { scale: 1.08 }}
                    whileTap={ocupado ? undefined : { scale: 0.82 }}
                    transition={POP}
                  >
                    <IconeCheck girando={ocupado} />
                  </motion.button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
