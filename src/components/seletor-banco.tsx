// Seletor de banco. Mostra o banco vinculado (logo + nome) ou "Sem banco" e
// abre um modal com busca sobre `consts/banks.ts` para escolher manualmente.
// Permite também não vincular nenhum banco (ícone genérico).

import { useMemo, useState } from "react";
import { BANCOS, buscarBancos, bancoPorNome } from "@/consts/banks";
import { ContaIcon } from "./conta-icon";

interface SeletorBancoProps {
  /** Nome do banco vinculado ou null para genérico. */
  value: string | null;
  onChange: (nome: string | null) => void;
  /**
   * "field" (padrão): botão largo com logo + nome + "Trocar".
   * "icon": botão compacto quadrado, só com o logo — para ficar ao lado de um input.
   */
  variant?: "field" | "icon";
}

function IconBusca() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconFechar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LogoBanco({ src, alt, size = 40 }: { src: string; alt: string; size?: number }) {
  return (
    <span
      className="flex items-center justify-center shrink-0 overflow-hidden bg-white"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), border: "1px solid #E3E6EC", padding: Math.round(size * 0.16) }}
    >
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </span>
  );
}

function Generico({ size = 40 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: "#EDEFF3", color: "#8C95A6" }}
    >
      <ContaIcon icon="bank" size={Math.round(size * 0.45)} />
    </span>
  );
}

export function SeletorBanco({ value, onChange, variant = "field" }: SeletorBancoProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const selecionado = bancoPorNome(value);

  const lista = useMemo(() => {
    const termo = busca.trim();
    if (termo) return buscarBancos(termo, 50);
    return [...BANCOS].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [busca]);

  function abrir() {
    setBusca("");
    setAberto(true);
  }

  function selecionar(nome: string | null) {
    onChange(nome);
    setAberto(false);
  }

  return (
    <div className={variant === "icon" ? "shrink-0" : undefined}>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={abrir}
          aria-label={selecionado ? `Banco: ${selecionado.name}` : "Escolher banco"}
          title={selecionado ? selecionado.name : "Escolher banco"}
          className="shrink-0 flex items-center justify-center bg-white rounded-xl hover:border-brand transition-colors"
          style={{ width: 52, height: 52, border: "1px solid #D4D8E0", padding: 9 }}
        >
          {selecionado ? (
            <img src={selecionado.icon} alt={selecionado.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-ink-muted">
              <ContaIcon icon="bank" size={22} />
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={abrir}
          className="w-full flex items-center gap-3 h-[52px] px-3.5 bg-surface rounded-xl hover:border-brand transition-colors text-left"
          style={{ border: "1px solid #D4D8E0" }}
        >
          {selecionado ? (
            <LogoBanco src={selecionado.icon} alt={selecionado.name} size={34} />
          ) : (
            <Generico size={34} />
          )}
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium text-ink truncate">
              {selecionado ? selecionado.name : "Sem banco"}
            </span>
            <span className="block text-[12px] text-ink-muted">
              {selecionado ? "logo reconhecido" : "usa um ícone genérico"}
            </span>
          </span>
          <span className="text-[13px] font-semibold text-brand shrink-0">Trocar</span>
        </button>
      )}

      {aberto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[95] p-4"
          style={{ background: "rgba(14,17,22,.5)", backdropFilter: "blur(3px)" }}
          onClick={() => setAberto(false)}
        >
          <div
            className="w-[460px] bg-surface rounded-[28px] animate-slide-up flex flex-col overflow-hidden"
            style={{
              maxHeight: "min(640px, calc(100vh - 48px))",
              boxShadow: "0 24px 60px -12px rgba(14,17,22,.35), 0 0 0 1px rgba(14,17,22,.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="w-9 h-1 rounded-full bg-border" />
            </div>

            <div className="flex items-start justify-between px-6 pt-2 pb-4">
              <div>
                <p className="text-[20px] font-bold text-ink tracking-tight leading-tight">Banco</p>
                <p className="text-[13px] text-ink-muted mt-0.5">
                  {BANCOS.length} bancos · toque para vincular
                </p>
              </div>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:bg-surface-subtle transition-colors text-ink-muted -mr-1"
              >
                <IconFechar />
              </button>
            </div>

            <div className="px-5 pb-2">
              <div className="flex items-center gap-2.5 h-12 px-4 rounded-2xl bg-surface-subtle border border-transparent focus-within:border-brand focus-within:bg-surface transition-colors">
                <IconBusca />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar banco…"
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] text-ink placeholder:text-ink-placeholder"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    aria-label="Limpar busca"
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-ink-muted hover:bg-border-subtle transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pt-1 pb-3">
              {/* Sem banco */}
              <button
                onClick={() => selecionar(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left mb-1"
                style={value === null ? { background: "#F0F2F6", boxShadow: "inset 0 0 0 1.5px #C4CAD4" } : undefined}
                onMouseEnter={(e) => { if (value !== null) e.currentTarget.style.background = "#F7F8FA"; }}
                onMouseLeave={(e) => { if (value !== null) e.currentTarget.style.background = ""; }}
              >
                <Generico size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">Sem banco</span>
                  <span className="block text-[12px] text-ink-muted">usa um ícone genérico</span>
                </span>
                {value === null && (
                  <span className="shrink-0 w-6 h-6 rounded-full bg-ink-muted text-white flex items-center justify-center">
                    <IconCheck />
                  </span>
                )}
              </button>

              {lista.length > 0 && <div className="h-px bg-border-subtle mx-3 my-1" />}

              {lista.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <span className="w-12 h-12 rounded-2xl bg-surface-subtle flex items-center justify-center text-ink-muted">
                    <IconBusca />
                  </span>
                  <p className="text-sm text-ink-muted">Nada encontrado para "{busca}".</p>
                </div>
              ) : (
                lista.map((b) => {
                  const ativo = selecionado?.name === b.name;
                  return (
                    <button
                      key={b.name}
                      onClick={() => selecionar(b.name)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left"
                      style={ativo ? { background: "#EAF1FD", boxShadow: "inset 0 0 0 1.5px #4078E6" } : undefined}
                      onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = "#F7F8FA"; }}
                      onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = ""; }}
                    >
                      <LogoBanco src={b.icon} alt={b.name} size={40} />
                      <span className="flex-1 min-w-0 text-[14.5px] font-semibold text-ink truncate">{b.name}</span>
                      {ativo && (
                        <span className="shrink-0 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center">
                          <IconCheck />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
