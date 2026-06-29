import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useToastStore, type Toast, type ToastTipo } from "./toast-store";

/**
 * Viewport de toasts. Monte uma única vez no topo da árvore (`main.tsx`).
 * Renderiza os toasts do store empilhados no canto inferior direito.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="fixed bottom-5 right-5 z-[1000] flex flex-col gap-3 w-[min(380px,calc(100vw-40px))] pointer-events-none"
      role="region"
      aria-label="Notificações"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

const ESTILOS: Record<
  ToastTipo,
  { borda: string; icone: string; Icone: () => ReactNode }
> = {
  sucesso: {
    borda: "border-l-positive",
    icone: "text-positive bg-positive-50",
    Icone: IconCheck,
  },
  erro: {
    borda: "border-l-negative",
    icone: "text-negative bg-negative-50",
    Icone: IconAlerta,
  },
  aviso: {
    borda: "border-l-warning",
    icone: "text-warning bg-warning-50",
    Icone: IconAlerta,
  },
  info: {
    borda: "border-l-brand",
    icone: "text-brand bg-brand-50",
    Icone: IconInfo,
  },
};

function ToastCard({ toast }: { toast: Toast }) {
  const remover = useToastStore((s) => s.remover);
  const [saindo, setSaindo] = useState(false);
  const estilo = ESTILOS[toast.tipo];

  const fechar = useCallback(() => {
    setSaindo(true);
    // espera a animação de saída antes de remover do store
    window.setTimeout(() => remover(toast.id), 180);
  }, [remover, toast.id]);

  useEffect(() => {
    if (toast.duracao <= 0) return;
    const timer = window.setTimeout(fechar, toast.duracao);
    return () => window.clearTimeout(timer);
  }, [toast.duracao, fechar]);

  const Icone = estilo.Icone;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 bg-surface rounded-2xl border border-border border-l-4 ${estilo.borda} shadow-[0_12px_32px_-8px_rgba(14,17,22,0.18)] px-4 py-3.5 ${
        saindo ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      <span
        className={`shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${estilo.icone}`}
      >
        <Icone />
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[14px] font-semibold text-ink leading-snug">
          {toast.titulo}
        </p>
        {toast.descricao && (
          <p className="text-[13px] text-ink-secondary leading-snug mt-0.5 break-words">
            {toast.descricao}
          </p>
        )}
      </div>
      <button
        onClick={fechar}
        aria-label="Fechar aviso"
        className="shrink-0 -mr-1 -mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-border-subtle transition-colors"
      >
        <IconFechar />
      </button>
    </div>
  );
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconAlerta() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" /><path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
  );
}

function IconFechar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
