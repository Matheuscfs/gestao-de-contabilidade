import { useState, useEffect, useCallback, useMemo } from "react";
import { CategoriaIcon } from "@/components/categoria-icon";
import { tratarErro } from "@/core/errors";
import {
  listarCategoriasPorTipo,
  contarPorCategoria,
  type Categoria,
  type TipoCategoria,
} from "@/core/db/categorias";

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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
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
    [categorias, value]
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
        <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">{label}</span>
      )}

      {/* Linha clicável */}
      <button
        type="button"
        onClick={abrir}
        className="w-full flex items-center gap-3 h-[52px] px-3.5 bg-surface rounded-xl hover:border-brand transition-colors text-left"
        style={{ border: "1px solid #D4D8E0" }}
      >
        {selecionada ? (
          <AvatarCategoria cor={selecionada.color} icon={selecionada.icon} size={32} />
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
              {contagem[selecionada.id] === 1 ? "registro" : "registros"} nesta categoria
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
          className="fixed inset-0 flex items-center justify-center z-[90]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={() => setAberto(false)}
        >
          <div
            className="w-[440px] bg-surface rounded-3xl shadow-lg animate-slide-up flex flex-col"
            style={{ maxHeight: "calc(100vh - 64px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
              <p className="text-[19px] font-bold text-ink tracking-tight">Selecionar categoria</p>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "#F0F2F6", color: "#5B616E" }}
              >
                <IconFechar />
              </button>
            </div>

            {/* Busca */}
            <div className="px-6 pb-3">
              <div className="flex items-center gap-2 h-11 px-3.5 bg-surface border border-border rounded-xl">
                <IconBusca />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar categoria…"
                  autoFocus
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {/* Sem categoria */}
              <button
                onClick={() => selecionar(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-subtle transition-colors text-left"
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#F0F2F6", color: "#8C95A6" }}
                >
                  <CategoriaIcon icon="tag" size={18} />
                </span>
                <span className="flex-1 text-[14px] font-medium text-ink-secondary">Sem categoria</span>
                {value === null && <span className="text-brand"><IconCheck /></span>}
              </button>

              {carregando ? (
                <div className="py-10 text-center text-sm text-ink-muted">Carregando…</div>
              ) : filtradas.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-muted">
                  {busca ? "Nenhuma categoria encontrada." : "Nenhuma categoria disponível."}
                </div>
              ) : (
                filtradas.map((c) => {
                  const n = contagem[c.id] ?? 0;
                  const ativo = value === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selecionar(c.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-subtle transition-colors text-left"
                    >
                      <AvatarCategoria cor={c.color} icon={c.icon} size={36} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-ink truncate">{c.name}</span>
                        <span className="block text-[12px] text-ink-muted">
                          {n > 0 ? `${n} ${n === 1 ? "registro" : "registros"}` : "nenhum registro ainda"}
                        </span>
                      </span>
                      {ativo && <span className="text-brand shrink-0"><IconCheck /></span>}
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
