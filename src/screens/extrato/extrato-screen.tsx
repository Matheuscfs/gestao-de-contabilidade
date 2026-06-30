import { useEffect, useMemo, useState } from "react";
import { formatarBRL } from "@/utils/money";
import { formatarData, formatarMesAno } from "@/utils/dates";
import { tratarErro } from "@/core/errors";
import { listarExtrato, type MovimentoExtrato } from "@/core/db/extrato";

// ─── Constantes de apresentação ────────────────────────────────────────────────

type Direcao = "entrada" | "saida" | "neutro";

const TIPOS: Record<string, { label: string; cor: string; tint: string; dir: Direcao }> = {
  INCOME: { label: "Receita", cor: "#12A06B", tint: "#E2F4EC", dir: "entrada" },
  SALARY: { label: "Salário", cor: "#0B6E4A", tint: "#DCFCE7", dir: "entrada" },
  EXPENSE: { label: "Despesa", cor: "#D74A45", tint: "#FBE9E7", dir: "saida" },
  INVOICE: { label: "Fatura", cor: "#E8A020", tint: "#FCF1DF", dir: "saida" },
  LIVING_COST: { label: "Custo de vida", cor: "#EA580C", tint: "#FFF1E8", dir: "saida" },
  DEBT: { label: "Dívida", cor: "#9333EA", tint: "#F3E8FF", dir: "saida" },
  DEBT_INSTALLMENT: { label: "Parcela", cor: "#7C3AED", tint: "#EDE9FE", dir: "saida" },
  TRANSFER: { label: "Transferência", cor: "#0891B2", tint: "#E0F2FE", dir: "neutro" },
  INVESTMENT: { label: "Investimento", cor: "#1E4BA3", tint: "#DBEAFE", dir: "neutro" },
};

function infoTipo(t: string) {
  return TIPOS[t] ?? { label: t, cor: "#5B616E", tint: "#F0F2F6", dir: "neutro" as Direcao };
}

const STATUS: Record<string, { label: string; cor: string; tint: string }> = {
  PREVISTO: { label: "Previsto", cor: "#5B616E", tint: "#F0F2F6" },
  CONFIRMADO: { label: "Confirmado", cor: "#0B6E4A", tint: "#E2F4EC" },
  CANCELADO: { label: "Cancelado", cor: "#D74A45", tint: "#FBE9E7" },
  ATIVO: { label: "Ativo", cor: "#1E4BA3", tint: "#DBEAFE" },
  PAGO: { label: "Pago", cor: "#0B6E4A", tint: "#E2F4EC" },
  VENCIDO: { label: "Vencido", cor: "#D74A45", tint: "#FBE9E7" },
  PARCIAL: { label: "Parcial", cor: "#E8A020", tint: "#FCF1DF" },
  EM_PROGRESSO: { label: "Em progresso", cor: "#0891B2", tint: "#E0F2FE" },
  CONCLUIDO: { label: "Concluído", cor: "#0B6E4A", tint: "#E2F4EC" },
};

function infoStatus(s: string) {
  return STATUS[s] ?? { label: s, cor: "#5B616E", tint: "#F0F2F6" };
}

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  PLUGGY: "Banco (Pluggy)",
};

const TODOS = "__todos__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dataEfetiva(m: MovimentoExtrato): Date {
  return new Date(m.date || m.dueDate || m.createdAt);
}

function valorExibicao(m: MovimentoExtrato): { texto: string; cor: string } {
  const dir = infoTipo(m.type).dir;
  const v = formatarBRL(m.amountCents);
  if (dir === "entrada") return { texto: `+ ${v}`, cor: "#12A06B" };
  if (dir === "saida") return { texto: `− ${v}`, cor: "#0E1116" };
  return { texto: v, cor: "#5B616E" };
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// ─── Ícone por tipo ─────────────────────────────────────────────────────────────

function IconeTipo({ type, size = 18 }: { type: string; size?: number }) {
  const props = {
    width: size,
    height: size,
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
    case "TRANSFER":
      return (
        <svg {...props}>
          <path d="m16 3 4 4-4 4" />
          <path d="M20 7H4" />
          <path d="m8 21-4-4 4-4" />
          <path d="M4 17h16" />
        </svg>
      );
    case "INVESTMENT":
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      );
    default: // EXPENSE, LIVING_COST e demais
      return (
        <svg {...props}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
  }
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────────

function Avatar({ m, size = 40 }: { m: MovimentoExtrato; size?: number }) {
  const t = infoTipo(m.type);
  const cor = m.categoryColor || t.cor;
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: t.tint, color: cor }}
    >
      <IconeTipo type={m.type} size={Math.round(size * 0.45)} />
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

function PontoCor({ cor }: { cor: string | null }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: cor || "#D4D8E0" }}
    />
  );
}

function Select({
  value,
  onChange,
  children,
  minWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-10 pl-3.5 pr-9 rounded-xl border border-border bg-surface text-[13px] font-semibold text-ink cursor-pointer outline-none focus:border-brand transition-colors"
        style={{ minWidth }}
      >
        {children}
      </select>
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ─── Modal de detalhes ──────────────────────────────────────────────────────────

function LinhaDetalhe({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-[13px] font-medium text-ink-muted shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-ink text-right min-w-0 break-words">
        {children}
      </span>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">{titulo}</p>
      <div className="divide-y divide-border-subtle">{children}</div>
    </div>
  );
}

function ModalDetalhes({ m, onClose }: { m: MovimentoExtrato; onClose: () => void }) {
  const t = infoTipo(m.type);
  const st = infoStatus(m.status);
  const valor = valorExibicao(m);
  const tags = parseTags(m.tags);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[90]"
      style={{ background: "rgba(14,17,22,.42)" }}
      onClick={onClose}
    >
      <div
        className="w-[560px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
        style={{ padding: "28px 28px 24px", maxHeight: "calc(100vh - 48px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar m={m} size={46} />
            <div className="min-w-0">
              <p className="text-[18px] font-bold text-ink tracking-tight truncate">
                {m.description}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Chip label={t.label} cor={t.cor} tint={t.tint} />
                <Chip label={st.label} cor={st.cor} tint={st.tint} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-[34px] h-[34px] rounded-full border-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
            style={{ background: "#F0F2F6", color: "#5B616E" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Valor */}
        <div
          className="rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: t.tint }}
        >
          <span className="text-[13px] font-semibold" style={{ color: t.cor }}>
            Valor
          </span>
          <span className="text-[26px] font-bold tabular-nums" style={{ color: valor.cor }}>
            {valor.texto}
          </span>
        </div>

        {/* Detalhes */}
        <Secao titulo="Detalhes">
          {m.date && <LinhaDetalhe label="Data">{formatarData(m.date, true)}</LinhaDetalhe>}
          {m.month && m.year && (
            <LinhaDetalhe label="Competência">
              <span className="capitalize">{formatarMesAno(m.month, m.year)}</span>
            </LinhaDetalhe>
          )}
          {m.dueDate && (
            <LinhaDetalhe label="Vencimento">{formatarData(m.dueDate, true)}</LinhaDetalhe>
          )}
          {m.paidAt && <LinhaDetalhe label="Pago em">{formatarData(m.paidAt, true)}</LinhaDetalhe>}
          {m.paidCents != null && (
            <LinhaDetalhe label="Valor pago">{formatarBRL(m.paidCents)}</LinhaDetalhe>
          )}
          {m.notes && <LinhaDetalhe label="Observações">{m.notes}</LinhaDetalhe>}
          {tags.length > 0 && (
            <LinhaDetalhe label="Tags">
              <span className="flex flex-wrap gap-1 justify-end">
                {tags.map((tag) => (
                  <Chip key={tag} label={tag} cor="#5B616E" tint="#F0F2F6" />
                ))}
              </span>
            </LinhaDetalhe>
          )}
        </Secao>

        {/* Fonte / Origem / Nicho */}
        <Secao titulo="Fonte e origem">
          <LinhaDetalhe label="Origem do registro">
            {SOURCE_LABEL[m.source] ?? m.source}
          </LinhaDetalhe>
          {m.accountName && (
            <LinhaDetalhe label="Conta">
              <span className="inline-flex items-center gap-2">
                <PontoCor cor={m.accountColor} />
                {m.accountName}
                {m.accountBank ? ` · ${m.accountBank}` : ""}
              </span>
            </LinhaDetalhe>
          )}
          {m.cardName && (
            <LinhaDetalhe label="Cartão">
              <span className="inline-flex items-center gap-2">
                <PontoCor cor={m.cardColor} />
                {m.cardName}
                {m.cardBrand ? ` · ${m.cardBrand}` : ""}
              </span>
            </LinhaDetalhe>
          )}
          {m.categoryName && (
            <LinhaDetalhe label="Categoria">
              <span className="inline-flex items-center gap-2">
                <PontoCor cor={m.categoryColor} />
                {m.categoryName}
              </span>
            </LinhaDetalhe>
          )}
          {m.personaName && (
            <LinhaDetalhe label="Persona">
              <span className="inline-flex items-center gap-2">
                <PontoCor cor={m.personaColor} />
                {m.personaName}
              </span>
            </LinhaDetalhe>
          )}
          {m.incomeModality && (
            <LinhaDetalhe label="Modalidade">{m.incomeModality}</LinhaDetalhe>
          )}
        </Secao>

        {(m.pluggyId || m.pluggySyncedAt) && (
          <Secao titulo="Sincronização">
            {m.pluggySyncedAt && (
              <LinhaDetalhe label="Sincronizado em">
                {formatarData(m.pluggySyncedAt, true)}
              </LinhaDetalhe>
            )}
            {m.pluggyId && (
              <LinhaDetalhe label="ID Pluggy">
                <span className="font-mono text-[11px] text-ink-muted">{m.pluggyId}</span>
              </LinhaDetalhe>
            )}
          </Secao>
        )}
      </div>
    </div>
  );
}

// ─── Tela principal ─────────────────────────────────────────────────────────────

export function ExtratoScreen() {
  const [movimentos, setMovimentos] = useState<MovimentoExtrato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [detalhe, setDetalhe] = useState<MovimentoExtrato | null>(null);

  // Filtros
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState(TODOS);
  const [origem, setOrigem] = useState(TODOS);
  const [contaId, setContaId] = useState(TODOS);
  const [cartaoId, setCartaoId] = useState(TODOS);
  const [categoriaId, setCategoriaId] = useState(TODOS);
  const [personaId, setPersonaId] = useState(TODOS);
  const [status, setStatus] = useState(TODOS);
  const [periodo, setPeriodo] = useState(TODOS);

  useEffect(() => {
    (async () => {
      try {
        setMovimentos(await listarExtrato());
      } catch (e) {
        tratarErro(e, {
          contexto: "carregar extrato",
          mensagemUsuario: "Não foi possível carregar o extrato.",
        });
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // ── Opções de filtro derivadas dos dados ────────────────────────────────────

  function opcoesPorId(
    chave: "conta" | "cartao" | "categoria" | "persona"
  ): { id: string; nome: string; cor: string | null }[] {
    const mapa = new Map<string, { id: string; nome: string; cor: string | null }>();
    for (const m of movimentos) {
      let id: string | null = null;
      let nome: string | null = null;
      let cor: string | null = null;
      if (chave === "conta") { id = m.accountId; nome = m.accountName; cor = m.accountColor; }
      else if (chave === "cartao") { id = m.cardId; nome = m.cardName; cor = m.cardColor; }
      else if (chave === "categoria") { id = m.categoryId; nome = m.categoryName; cor = m.categoryColor; }
      else { id = m.personaId; nome = m.personaName; cor = m.personaColor; }
      if (id && nome && !mapa.has(id)) mapa.set(id, { id, nome, cor });
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  const contas = useMemo(() => opcoesPorId("conta"), [movimentos]);
  const cartoes = useMemo(() => opcoesPorId("cartao"), [movimentos]);
  const categorias = useMemo(() => opcoesPorId("categoria"), [movimentos]);
  const personas = useMemo(() => opcoesPorId("persona"), [movimentos]);

  const tiposPresentes = useMemo(() => {
    const s = new Set(movimentos.map((m) => m.type));
    return [...s].sort();
  }, [movimentos]);

  const statusPresentes = useMemo(() => {
    const s = new Set(movimentos.map((m) => m.status));
    return [...s].sort();
  }, [movimentos]);

  const origensPresentes = useMemo(() => {
    const s = new Set(movimentos.map((m) => m.source));
    return [...s].sort();
  }, [movimentos]);

  // ── Aplicação dos filtros ────────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    const agora = new Date();
    const termo = busca.trim().toLowerCase();

    return movimentos.filter((m) => {
      if (tipo !== TODOS && m.type !== tipo) return false;
      if (origem !== TODOS && m.source !== origem) return false;
      if (contaId !== TODOS && m.accountId !== contaId) return false;
      if (cartaoId !== TODOS && m.cardId !== cartaoId) return false;
      if (categoriaId !== TODOS && m.categoryId !== categoriaId) return false;
      if (personaId !== TODOS && m.personaId !== personaId) return false;
      if (status !== TODOS && m.status !== status) return false;

      if (periodo !== TODOS) {
        const d = dataEfetiva(m);
        const mesAtual = agora.getMonth();
        const anoAtual = agora.getFullYear();
        if (periodo === "MES_ATUAL") {
          if (d.getMonth() !== mesAtual || d.getFullYear() !== anoAtual) return false;
        } else if (periodo === "MES_PASSADO") {
          const ant = new Date(anoAtual, mesAtual - 1, 1);
          if (d.getMonth() !== ant.getMonth() || d.getFullYear() !== ant.getFullYear()) return false;
        } else if (periodo === "ULTIMOS_3") {
          const limite = new Date(anoAtual, mesAtual - 2, 1);
          if (d < limite) return false;
        } else if (periodo === "ANO_ATUAL") {
          if (d.getFullYear() !== anoAtual) return false;
        }
      }

      if (termo) {
        const alvo = [
          m.description,
          m.notes,
          m.accountName,
          m.cardName,
          m.categoryName,
          m.personaName,
          m.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }

      return true;
    });
  }, [movimentos, busca, tipo, origem, contaId, cartaoId, categoriaId, personaId, status, periodo]);

  // ── Estatísticas ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const m of filtrados) {
      const dir = infoTipo(m.type).dir;
      if (dir === "entrada") entradas += m.amountCents;
      else if (dir === "saida") saidas += m.amountCents;
    }
    return { total: filtrados.length, entradas, saidas, saldo: entradas - saidas };
  }, [filtrados]);

  const filtrosAtivos =
    busca.trim() !== "" ||
    [tipo, origem, contaId, cartaoId, categoriaId, personaId, status, periodo].some(
      (v) => v !== TODOS
    );

  function limparFiltros() {
    setBusca("");
    setTipo(TODOS);
    setOrigem(TODOS);
    setContaId(TODOS);
    setCartaoId(TODOS);
    setCategoriaId(TODOS);
    setPersonaId(TODOS);
    setStatus(TODOS);
    setPeriodo(TODOS);
  }

  const GRID = "104px minmax(0,1fr) 168px 184px 148px 52px";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">movimentos</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {carregando ? "—" : stats.total}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">entradas</p>
          <p className="text-[22px] font-bold tabular-nums mt-1" style={{ color: "#12A06B" }}>
            {carregando ? "—" : `+ ${formatarBRL(stats.entradas)}`}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">saídas</p>
          <p className="text-[22px] font-bold tabular-nums mt-1 text-ink">
            {carregando ? "—" : `− ${formatarBRL(stats.saidas)}`}
          </p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">saldo</p>
          <p
            className="text-[22px] font-bold tabular-nums mt-1"
            style={{ color: stats.saldo >= 0 ? "#12A06B" : "#D74A45" }}
          >
            {carregando ? "—" : `${stats.saldo >= 0 ? "+" : "−"} ${formatarBRL(Math.abs(stats.saldo))}`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 w-64 h-10 px-3.5 bg-surface border border-border rounded-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no extrato…"
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
          />
        </div>

        <Select value={periodo} onChange={setPeriodo}>
          <option value={TODOS}>Qualquer período</option>
          <option value="MES_ATUAL">Este mês</option>
          <option value="MES_PASSADO">Mês passado</option>
          <option value="ULTIMOS_3">Últimos 3 meses</option>
          <option value="ANO_ATUAL">Este ano</option>
        </Select>

        <Select value={tipo} onChange={setTipo}>
          <option value={TODOS}>Todos os tipos</option>
          {tiposPresentes.map((t) => (
            <option key={t} value={t}>{infoTipo(t).label}</option>
          ))}
        </Select>

        <Select value={status} onChange={setStatus}>
          <option value={TODOS}>Qualquer status</option>
          {statusPresentes.map((s) => (
            <option key={s} value={s}>{infoStatus(s).label}</option>
          ))}
        </Select>

        {contas.length > 0 && (
          <Select value={contaId} onChange={setContaId}>
            <option value={TODOS}>Todas as contas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        )}

        {cartoes.length > 0 && (
          <Select value={cartaoId} onChange={setCartaoId}>
            <option value={TODOS}>Todos os cartões</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        )}

        {categorias.length > 0 && (
          <Select value={categoriaId} onChange={setCategoriaId}>
            <option value={TODOS}>Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        )}

        {personas.length > 0 && (
          <Select value={personaId} onChange={setPersonaId}>
            <option value={TODOS}>Todas as personas</option>
            {personas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        )}

        {origensPresentes.length > 1 && (
          <Select value={origem} onChange={setOrigem}>
            <option value={TODOS}>Toda origem</option>
            {origensPresentes.map((s) => (
              <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>
            ))}
          </Select>
        )}

        {filtrosAtivos && (
          <button
            onClick={limparFiltros}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-border bg-surface text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
            Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div
          className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center"
          style={{ gridTemplateColumns: GRID }}
        >
          <span className="text-xs font-semibold text-ink-muted">Data</span>
          <span className="text-xs font-semibold text-ink-muted">Descrição</span>
          <span className="text-xs font-semibold text-ink-muted">Categoria</span>
          <span className="text-xs font-semibold text-ink-muted">Conta / Cartão</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Valor</span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-1">
            <p className="text-sm font-medium text-ink-muted">
              {filtrosAtivos
                ? "Nenhum movimento para os filtros selecionados."
                : "Nenhum movimento no extrato ainda."}
            </p>
            {!filtrosAtivos && (
              <p className="text-xs text-ink-placeholder">
                Sincronize um banco ou cadastre lançamentos para ver o extrato aqui.
              </p>
            )}
          </div>
        ) : (
          filtrados.map((m, i) => {
            const t = infoTipo(m.type);
            const st = infoStatus(m.status);
            const valor = valorExibicao(m);
            const origemNome = m.cardName || m.accountName;
            const origemCor = m.cardName ? m.cardColor : m.accountColor;
            return (
              <div key={m.id}>
                <div className="grid px-5 py-3 items-center" style={{ gridTemplateColumns: GRID }}>
                  {/* Data */}
                  <span className="text-[12px] font-medium text-ink-muted">
                    {m.date || m.dueDate ? formatarData(m.date || m.dueDate!) : "—"}
                  </span>

                  {/* Descrição */}
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <Avatar m={m} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">{m.description}</p>
                      <p className="text-[12px] text-ink-muted mt-0.5 flex items-center gap-1.5">
                        <span style={{ color: t.cor }}>{t.label}</span>
                        <span className="text-ink-placeholder">·</span>
                        <span style={{ color: st.cor }}>{st.label}</span>
                      </p>
                    </div>
                  </div>

                  {/* Categoria */}
                  <div className="min-w-0 pr-3">
                    {m.categoryName ? (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <PontoCor cor={m.categoryColor} />
                        <span className="text-[13px] font-medium text-ink truncate">
                          {m.categoryName}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-placeholder">—</span>
                    )}
                  </div>

                  {/* Conta / Cartão */}
                  <div className="min-w-0 pr-3">
                    {origemNome ? (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <PontoCor cor={origemCor} />
                        <span className="text-[13px] font-medium text-ink truncate">
                          {origemNome}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-placeholder">—</span>
                    )}
                  </div>

                  {/* Valor */}
                  <span
                    className="text-[14px] font-semibold tabular-nums text-right"
                    style={{ color: valor.cor }}
                  >
                    {valor.texto}
                  </span>

                  {/* Olhinho */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setDetalhe(m)}
                      aria-label="Ver detalhes"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-brand hover:bg-surface-subtle transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>
                {i < filtrados.length - 1 && <div className="h-px bg-border-subtle mx-5" />}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de detalhes */}
      {detalhe && <ModalDetalhes m={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  );
}
