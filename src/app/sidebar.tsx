import { usePerfilStore } from "@/app/perfil-store";
import { modoDaRota, useModoStore, type Modo } from "@/app/modo-store";
import quiboMark from "@/assets/logo/quibo-mark.png";
import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

type SvgPart = [string, Record<string, string | number>];

const ICONS: Record<string, SvgPart[]> = {
  calendar: [
    ["path", { d: "M8 2v4" }],
    ["path", { d: "M16 2v4" }],
    ["rect", { width: 18, height: 18, x: 3, y: 4, rx: 2 }],
    ["path", { d: "M3 10h18" }],
  ],
  "trending-up": [
    ["polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17" }],
    ["polyline", { points: "16 7 22 7 22 13" }],
  ],
  receipt: [
    [
      "path",
      {
        d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z",
      },
    ],
    ["path", { d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" }],
    ["path", { d: "M12 17.5v-11" }],
  ],
  "credit-card": [
    ["rect", { width: 20, height: 14, x: 2, y: 5, rx: 2 }],
    ["line", { x1: 2, x2: 22, y1: 10, y2: 10 }],
  ],
  "check-circle": [
    ["circle", { cx: 12, cy: 12, r: 10 }],
    ["path", { d: "m9 12 2 2 4-4" }],
  ],
  coins: [
    ["circle", { cx: 8, cy: 8, r: 6 }],
    ["path", { d: "M18.09 10.37A6 6 0 1 1 10.34 18" }],
    ["path", { d: "M7 6h1v4" }],
    ["path", { d: "m16.71 13.88.7.71-2.82 2.82" }],
  ],
  "piggy-bank": [
    [
      "path",
      {
        d: "M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z",
      },
    ],
    ["path", { d: "M2 9v1c0 1.1.9 2 2 2h1" }],
    ["path", { d: "M16 11h.01" }],
  ],
  "bar-chart": [
    ["path", { d: "M3 3v18h18" }],
    ["path", { d: "M18 17V9" }],
    ["path", { d: "M13 17V5" }],
    ["path", { d: "M8 17v-3" }],
  ],
  building: [
    ["path", { d: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" }],
    ["path", { d: "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" }],
    ["path", { d: "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" }],
    ["path", { d: "M10 6h4" }],
    ["path", { d: "M10 10h4" }],
    ["path", { d: "M10 14h4" }],
    ["path", { d: "M10 18h4" }],
  ],
  list: [
    ["line", { x1: 8, x2: 21, y1: 6, y2: 6 }],
    ["line", { x1: 8, x2: 21, y1: 12, y2: 12 }],
    ["line", { x1: 8, x2: 21, y1: 18, y2: 18 }],
    ["line", { x1: 3, x2: 3.01, y1: 6, y2: 6 }],
    ["line", { x1: 3, x2: 3.01, y1: 12, y2: 12 }],
    ["line", { x1: 3, x2: 3.01, y1: 18, y2: 18 }],
  ],
  kanban: [
    ["rect", { width: 7, height: 9, x: 3, y: 3, rx: 1 }],
    ["rect", { width: 7, height: 5, x: 14, y: 3, rx: 1 }],
    ["rect", { width: 7, height: 9, x: 14, y: 12, rx: 1 }],
    ["rect", { width: 7, height: 5, x: 3, y: 16, rx: 1 }],
  ],
  "list-checks": [
    ["path", { d: "m3 17 2 2 4-4" }],
    ["path", { d: "m3 7 2 2 4-4" }],
    ["path", { d: "M13 6h8" }],
    ["path", { d: "M13 12h8" }],
    ["path", { d: "M13 18h8" }],
  ],
  sparkles: [
    [
      "path",
      {
        d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
      },
    ],
    ["path", { d: "M20 3v4" }],
    ["path", { d: "M22 5h-4" }],
    ["path", { d: "M4 17v2" }],
    ["path", { d: "M5 18H3" }],
  ],
};

function NavIcon({ name }: { name: string }) {
  const parts = ICONS[name] ?? [];
  return (
    <svg
      width={21}
      height={21}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {parts.map(([tag, attrs], i) =>
        React.createElement(tag, { key: i, ...attrs }),
      )}
    </svg>
  );
}

/** Telas de finanças pessoais. */
const NAV_PESSOAL = [
  { to: "/mes", id: "mes", label: "Mês", icon: "calendar" },
  {
    to: "/lancamentos",
    id: "lancamentos",
    label: "Lançamentos",
    icon: "check-circle",
  },
  { to: "/extrato", id: "extrato", label: "Extrato", icon: "list" },
  { to: "/receitas", id: "receitas", label: "Receitas", icon: "trending-up" },
  {
    to: "/custo-de-vida",
    id: "custo",
    label: "Custo de vida",
    icon: "receipt",
  },
  { to: "/cartoes", id: "cartoes", label: "Cartões", icon: "credit-card" },
  { to: "/dividas", id: "dividas", label: "Dívidas", icon: "coins" },
  {
    to: "/investimentos",
    id: "investimentos",
    label: "Investimentos",
    icon: "piggy-bank",
  },
  { to: "/analise", id: "analise", label: "Análise", icon: "bar-chart" },
] as const;

/** Telas do escritório contábil. */
const NAV_CONTABIL = [
  { to: "/kanban", id: "kanban", label: "Kanban do mês", icon: "kanban" },
  { to: "/empresas", id: "empresas", label: "Empresas", icon: "building" },
  { to: "/fluxos", id: "fluxos", label: "Fluxos", icon: "list-checks" },
] as const;

/** A IA fala das duas coisas, então aparece nos dois modos. */
const NAV_COMUM = [{ to: "/ia", id: "ia", label: "IA", icon: "sparkles" }] as const;

function AlternadorModo({
  modo,
  onTrocar,
}: {
  modo: Modo;
  onTrocar: (m: Modo) => void;
}) {
  const opcoes: { id: Modo; label: string; titulo: string }[] = [
    { id: "pessoal", label: "P", titulo: "Finanças pessoais" },
    { id: "contabil", label: "C", titulo: "Contabilidade" },
  ];

  return (
    <div
      className="no-drag flex items-center gap-0.5 p-0.5 rounded-full mb-3"
      style={{ background: "#F0F2F6" }}
    >
      {opcoes.map((o) => {
        const ativo = modo === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onTrocar(o.id)}
            title={o.titulo}
            aria-label={o.titulo}
            aria-pressed={ativo}
            className="w-[26px] h-[26px] rounded-full text-[12px] font-bold transition-all"
            style={
              ativo
                ? { background: "#fff", color: "#0E1116", boxShadow: "0 1px 2px rgba(14,17,22,.12)" }
                : { background: "transparent", color: "#8A909B" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { nome, foto, iniciais } = usePerfilStore();
  const { modo, definirModo } = useModoStore();

  // Entrar numa rota contábil por link direto (ex.: voltar de /empresas/:id)
  // acerta o modo sozinho, senão a sidebar mostraria o conjunto errado.
  useEffect(() => {
    const daRota = modoDaRota(location.pathname);
    if (daRota && daRota !== modo) definirModo(daRota);
  }, [location.pathname, modo, definirModo]);

  const itens = [
    ...(modo === "pessoal" ? NAV_PESSOAL : NAV_CONTABIL),
    ...NAV_COMUM,
  ];

  function trocarModo(novo: Modo) {
    if (novo === modo) return;
    definirModo(novo);
    navigate(novo === "pessoal" ? "/mes" : "/kanban");
  }

  return (
    <aside className="drag-region shrink-0 w-[68px] flex flex-col items-center bg-surface border border-border rounded-[22px] py-3.5 shadow-xs">
      {/* Logo */}
      <div className="no-drag mb-3">
        <img src={quiboMark} alt="Gestão de Contabilidade" className="w-9 h-9 object-contain" />
      </div>

      <AlternadorModo modo={modo} onTrocar={trocarModo} />

      {/* Navegação */}
      <nav className="no-drag flex flex-col items-center gap-1.5">
        {itens.map(({ to, id, label, icon }) => (
          <div
            key={id}
            className="relative"
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
          >
            <NavLink
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                [
                  "w-11 h-11 flex items-center justify-center rounded-xl transition-all",
                  isActive
                    ? "bg-brand text-white"
                    : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                ].join(" ")
              }
            >
              <NavIcon name={icon} />
            </NavLink>

            {hovered === id && (
              <div className="absolute left-[54px] top-1/2 -translate-y-1/2 z-50 bg-ink text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-md pointer-events-none">
                {label}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Perfil */}
      <div className="no-drag mt-auto flex flex-col items-center gap-3.5">
        <div className="w-9 h-px bg-border" />
        <button
          onClick={() => navigate("/perfil")}
          aria-label={nome ? `Perfil de ${nome}` : "Perfil"}
          className="w-9 h-9 rounded-full overflow-hidden border border-border hover:ring-2 hover:ring-brand hover:ring-offset-1 transition-all"
        >
          {foto ? (
            <img
              src={foto}
              alt={nome || "Perfil"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-brand-50 text-brand font-bold text-sm flex items-center justify-center hover:bg-brand hover:text-white transition-colors">
              {iniciais || "?"}
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
