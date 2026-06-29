import { motion } from "motion/react";

const POP = { type: "spring", stiffness: 500, damping: 16 } as const;

export function LancamentosScreen() {
  return (
    <div className="animate-fade-in">
      <div className="max-w-[680px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[28px] font-bold text-ink tracking-tight">Bora confirmar?</h1>
          <p className="text-[15px] text-ink-secondary mt-1.5">
            Toque no círculo pra confirmar cada item do mês.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3.5 px-5 py-4 border-b border-border-subtle">
            <div className="w-10 h-10 rounded-xl bg-positive-50 text-positive flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink">Salário</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">entra · —</p>
            </div>
            <span className="text-base font-semibold text-positive tabular-nums mr-3.5">+ R$ —</span>
            <motion.button
              aria-label="Confirmar"
              className="w-[46px] h-[46px] rounded-full border-2 border-brand text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-colors shrink-0"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.82 }}
              transition={POP}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </motion.button>
          </div>

          <div className="flex items-center gap-3.5 px-5 py-4 border-b border-border-subtle">
            <div className="w-10 h-10 rounded-xl bg-surface-subtle text-ink-secondary flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink">Fatura</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">sai · vence em breve</p>
            </div>
            <span className="text-base font-semibold text-ink tabular-nums mr-3.5">− R$ —</span>
            <motion.button
              aria-label="Confirmar"
              className="w-[46px] h-[46px] rounded-full border-2 border-brand text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-colors shrink-0"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.82 }}
              transition={POP}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </motion.button>
          </div>

          <div className="px-5 py-4 text-sm text-ink-muted text-center">
            Nenhum lançamento pendente para confirmar.
          </div>
        </div>
      </div>
    </div>
  );
}
