/**
 * MoneyInput — input com máscara de moeda brasileira (R$).
 *
 * Valor controlado em centavos inteiros (i64-safe). Limite: R$ 1.000.000.000,00.
 *
 * Comportamento da máscara (padrão caixa registradora):
 *  - Digitar "1"       → R$ 0,01
 *  - Digitar "2"       → R$ 0,12
 *  - Digitar "3"       → R$ 1,23
 *  - Backspace         → remove o último dígito
 *  - Delete            → zera o campo
 *  - Colar "1.234,56"  → R$ 1.234,56 (extrai apenas dígitos)
 *
 * Uso:
 *   <MoneyInput centavos={valor} onChange={setValor} />
 *   <MoneyInput centavos={valor} onChange={setValor} size="lg" placeholder="0,00" />
 */

import { type KeyboardEvent, type ClipboardEvent } from "react";

// R$ 1.000.000.000,00 = 100_000_000_000 centavos
const MAX_CENTAVOS = 100_000_000_000;

const FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function centavosParaDisplay(centavos: number): string {
  return FORMATTER.format(centavos / 100);
}

function digitosDoCentavos(centavos: number, digitoNovo: number): number {
  const proximo = centavos * 10 + digitoNovo;
  return proximo > MAX_CENTAVOS ? centavos : proximo;
}

// ─── Tamanhos predefinidos ────────────────────────────────────────────────────

const SIZES = {
  sm: {
    wrapper: "h-10 px-3.5 gap-2 rounded-xl",
    prefixo: "text-sm font-semibold",
    input: "text-sm font-semibold",
  },
  md: {
    wrapper: "h-[52px] px-4 gap-2 rounded-xl",
    prefixo: "text-[15px] font-semibold",
    input: "text-[16px] font-semibold",
  },
  lg: {
    wrapper: "h-[62px] px-5 gap-3 rounded-2xl",
    prefixo: "text-lg font-bold",
    input: "text-[20px] font-bold",
  },
} as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MoneyInputProps {
  /** Valor atual em centavos inteiros */
  centavos: number;
  /** Chamado com o novo valor em centavos após cada interação */
  onChange: (centavos: number) => void;
  placeholder?: string;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
  /** Classe aplicada ao wrapper (div externo) */
  className?: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MoneyInput({
  centavos,
  onChange,
  placeholder = "0,00",
  size = "md",
  disabled = false,
  autoFocus = false,
  id,
  "aria-label": ariaLabel,
  className = "",
}: MoneyInputProps) {
  const s = SIZES[size];
  const displayValue = centavos > 0 ? centavosParaDisplay(centavos) : "";

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      onChange(digitosDoCentavos(centavos, parseInt(e.key, 10)));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      onChange(Math.floor(centavos / 10));
    } else if (e.key === "Delete") {
      e.preventDefault();
      onChange(0);
    }
    // Tab, setas, etc. passam sem interceptar
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const texto = e.clipboardData.getData("text");
    const apenasDigitos = texto.replace(/\D/g, "");
    if (!apenasDigitos) return;
    const novoCentavos = Math.min(parseInt(apenasDigitos, 10), MAX_CENTAVOS);
    onChange(novoCentavos);
  }

  return (
    <div
      className={`
        flex items-center bg-surface border border-border-strong
        focus-within:border-brand transition-colors
        ${s.wrapper}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      <span className={`${s.prefixo} text-ink-muted select-none shrink-0`}>
        R$
      </span>
      <input
        id={id}
        aria-label={ariaLabel}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`
          flex-1 min-w-0 border-none outline-none bg-transparent
          tabular-nums text-ink placeholder:text-ink-placeholder
          disabled:cursor-not-allowed
          ${s.input}
        `}
      />
    </div>
  );
}
