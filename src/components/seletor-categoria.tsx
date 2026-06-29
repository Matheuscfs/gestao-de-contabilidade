import { CategoriaIcon } from "@/components/categoria-icon";
import {
  contarPorCategoria,
  listarCategoriasPorTipo,
  type Categoria,
  type TipoCategoria,
} from "@/core/db/categorias";
import { tratarErro } from "@/core/errors";
import { useCallback, useEffect, useMemo, useState } from "react";

// ─── Origem ───────────────────────────────────────────────────────────────────
//
// Identifica o "balde" de registros usado para contar quantos itens já estão
// vinculados a cada categoria — a combinação type + is_template de `transactions`.
//   Custo de vida → { type: "LIVING_COST", isTemplate: true }
//   Receitas      → { type: "INCOME",      isTemplate: true }
//   Lançamentos   → { type: "EXPENSE",     isTemplate: false }
// ─────────────────────────────────────────────────────────────────────────────

export type OrigemCategoria = { type: string; isTemplate: boolean };

interface SeletorCategoriaProps {
  /** id da categoria selecionada (ou null = sem categoria) */
  value: string | null;
  onChange: (id: string | null) => void;
  /** quais categorias listar */
  tipo: TipoCategoria;
  /** origem usada para contar registros já vinculados a cada categoria */
  origem: OrigemCategoria;
  /** rótulo opcional acima do seletor */
  label?: string;
}

// ─── Ícones auxiliares ────────────────────────────────────────────────────────

function IconAlterar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconBusca() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-muted shrink-0"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconFechar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ─── Avatar de categoria ──────────────────────────────────────────────────────

function AvatarCategoria({
  cor,
  icon,
  size = 36,
}: {
  cor: string;
  icon: string | null;
  size?: number;
}) {
  return (
    <span
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: `${cor}1A`, color: cor }}
    >
      <CategoriaIcon icon={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SeletorCategoria({
  value,
  onChange,
  tipo,
  origem,
  label,
}: SeletorCategoriaProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, mapa] = await Promise.all([
        listarCategoriasPorTipo(tipo),
        contarPorCategoria(origem.type, origem.isTemplate),
      ]);
      setCategorias(lista);
      setContagem(mapa);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar categorias",
        mensagemUsuario: "Não foi possível carregar as categorias.",
      });
    } finally {
      setCarregando(false);
    }
  }, [tipo, origem.type, origem.isTemplate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Recarrega contagem/lista ao abrir (cobre categorias criadas em outro lugar).
  function abrir() {
    setBusca("");
    setAberto(true);
    carregar();
  }

  const selecionada = useMemo(
    () => categorias.find((c) => c.id === value) ?? null,
    [categorias, value],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? categorias.filter((c) => c.name.toLowerCase().includes(termo))
      : categorias;
    // Mais usadas primeiro, depois alfabética.
    return [...base].sort((a, b) => {
      const na = contagem[a.id] ?? 0;
      const nb = contagem[b.id] ?? 0;
      if (nb !== na) return nb - na;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [categorias, busca, contagem]);

  function selecionar(id: string | null) {
    onChange(id);
    setAberto(false);
  }

  return (
    <div>
      {label && (
        <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">
          {label}
        </span>
      )}

      {/* Linha clicável */}
      <button
        type="button"
        onClick={abrir}
        className="w-full flex items-center gap-3 h-[52px] px-3.5 bg-surface rounded-xl hover:border-brand transition-colors text-left"
        style={{ border: "1px solid #D4D8E0" }}
      >
        {selecionada ? (
          <AvatarCategoria
            cor={selecionada.color}
            icon={selecionada.icon}
            size={32}
          />
        ) : (
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#F0F2F6", color: "#8C95A6" }}
          >
            <CategoriaIcon icon="tag" size={16} />
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium text-ink truncate">
            {selecionada ? selecionada.name : "Selecionar categoria"}
          </span>
          {selecionada && (contagem[selecionada.id] ?? 0) > 0 && (
            <span className="block text-[12px] text-ink-muted">
              {contagem[selecionada.id]}{" "}
              {contagem[selecionada.id] === 1 ? "registro" : "registros"}
            </span>
          )}
        </span>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-ink-muted">
          <IconAlterar />
        </span>
      </button>

      {/* Modal de seleção */}
      {aberto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[90] p-4"
          style={{
            background: "rgba(14,17,22,.5)",
            backdropFilter: "blur(3px)",
          }}
          onClick={() => setAberto(false)}
        >
          <div
            className="w-[460px] bg-surface rounded-[28px] animate-slide-up flex flex-col overflow-hidden"
            style={{
              maxHeight: "min(640px, calc(100vh - 48px))",
              boxShadow:
                "0 24px 60px -12px rgba(14,17,22,.35), 0 0 0 1px rgba(14,17,22,.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <span className="w-9 h-1 rounded-full bg-border" />
            </div>

            {/* Cabeçalho */}
            <div className="flex items-start justify-between px-6 pt-2 pb-4">
              <div>
                <p className="text-[20px] font-bold text-ink tracking-tight leading-tight">
                  Categorias
                </p>
                <p className="text-[13px] text-ink-muted mt-0.5">
                  {carregando
                    ? "carregando…"
                    : `${categorias.length} ${categorias.length === 1 ? "categoria" : "categorias"} · toque para escolher`}
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

            {/* Busca */}
            <div className="px-5 pb-2">
              <div className="flex items-center gap-2.5 h-12 px-4 rounded-2xl bg-surface-subtle border border-transparent focus-within:border-brand focus-within:bg-surface transition-colors">
                <IconBusca />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar categoria…"
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] text-ink placeholder:text-ink-placeholder"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    aria-label="Limpar busca"
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-ink-muted hover:bg-border-subtle transition-colors"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-3 pt-1 pb-3">
              {/* Sem categoria */}
              <button
                onClick={() => selecionar(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left mb-1"
                style={
                  value === null
                    ? {
                        background: "#F0F2F6",
                        boxShadow: "inset 0 0 0 1.5px #C4CAD4",
                      }
                    : undefined
                }
                onMouseEnter={(e) => {
                  if (value !== null)
                    e.currentTarget.style.background = "#F7F8FA";
                }}
                onMouseLeave={(e) => {
                  if (value !== null) e.currentTarget.style.background = "";
                }}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#EDEFF3", color: "#8C95A6" }}
                >
                  <CategoriaIcon icon="tag" size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">
                    Sem categoria
                  </span>
                  <span className="block text-[12px] text-ink-muted">
                    deixar sem classificar
                  </span>
                </span>
                {value === null && (
                  <span className="shrink-0 w-6 h-6 rounded-full bg-ink-muted text-white flex items-center justify-center">
                    <IconCheck />
                  </span>
                )}
              </button>

              {!carregando && filtradas.length > 0 && (
                <div className="h-px bg-border-subtle mx-3 my-1" />
              )}

              {carregando ? (
                <div className="py-12 text-center text-sm text-ink-muted">
                  Carregando…
                </div>
              ) : filtradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <span className="w-12 h-12 rounded-2xl bg-surface-subtle flex items-center justify-center text-ink-muted">
                    <IconBusca />
                  </span>
                  <p className="text-sm text-ink-muted">
                    {busca
                      ? `Nada encontrado para "${busca}".`
                      : "Nenhuma categoria disponível."}
                  </p>
                </div>
              ) : (
                filtradas.map((c) => {
                  const n = contagem[c.id] ?? 0;
                  const ativo = value === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selecionar(c.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left"
                      style={
                        ativo
                          ? {
                              background: `${c.color}14`,
                              boxShadow: `inset 0 0 0 1.5px ${c.color}`,
                            }
                          : undefined
                      }
                      onMouseEnter={(e) => {
                        if (!ativo)
                          e.currentTarget.style.background = "#F7F8FA";
                      }}
                      onMouseLeave={(e) => {
                        if (!ativo) e.currentTarget.style.background = "";
                      }}
                    >
                      <AvatarCategoria cor={c.color} icon={c.icon} size={40} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px] font-semibold text-ink truncate">
                          {c.name}
                        </span>
                        <span className="block text-[12px] text-ink-muted">
                          {n > 0
                            ? `${n} ${n === 1 ? "registro" : "registros"}`
                            : "ainda não usada aqui"}
                        </span>
                      </span>

                      {/* Chip de uso */}
                      {n > 0 && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center min-w-[26px] h-[22px] px-2 rounded-full text-[12px] font-bold tabular-nums"
                          style={{ background: `${c.color}1A`, color: c.color }}
                        >
                          {n}
                        </span>
                      )}
                      {ativo && (
                        <span
                          className="shrink-0 w-6 h-6 rounded-full text-white flex items-center justify-center"
                          style={{ background: c.color }}
                        >
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
