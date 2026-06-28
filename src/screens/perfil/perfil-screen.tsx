import { useNavigate } from "react-router-dom";

function ChevronRight() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C2C7D0"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ItemIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[38px] h-[38px] rounded-[11px] bg-surface-subtle text-ink-secondary flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

function ContextIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-[10px] bg-surface-subtle text-ink-secondary flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-ink tracking-tight mt-6 mb-3 px-1">
      {children}
    </h2>
  );
}

function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border-subtle mx-5" />;
}

export function PerfilScreen() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in">
      <div className="max-w-[720px] mx-auto">
        {/* Card do usuário */}
        <div className="bg-surface border border-border rounded-2xl px-6 py-5 flex items-center gap-[18px]">
          <div className="w-[68px] h-[68px] rounded-full bg-brand-50 text-brand flex items-center justify-center font-bold text-2xl shrink-0">
            MR
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[22px] font-bold text-ink tracking-tight">Marina Rocha</p>
            <p className="text-sm text-ink-secondary mt-0.5">
              marina@email.com · no Quibo desde mar 2025
            </p>
          </div>
          <button className="h-[42px] px-[18px] rounded-full border border-border-strong bg-surface text-ink text-sm font-semibold hover:bg-surface-subtle transition-colors shrink-0">
            Editar
          </button>
        </div>

        {/* Gerenciar */}
        <SectionTitle>Gerenciar</SectionTitle>
        <ListCard>
          <button
            onClick={() => navigate("/contas")}
            className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-surface-subtle transition-colors"
          >
            <ItemIcon>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
                <path d="M3 5a2 2 0 0 0 2 2h15a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4" />
              </svg>
            </ItemIcon>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-semibold text-ink">Contas</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">onde seu dinheiro fica</p>
            </div>
            <ChevronRight />
          </button>

          <Divider />

          <button
            onClick={() => navigate("/categorias")}
            className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-surface-subtle transition-colors"
          >
            <ItemIcon>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </ItemIcon>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-semibold text-ink">Categorias</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">como você agrupa os gastos</p>
            </div>
            <ChevronRight />
          </button>

          <Divider />

          <button
            onClick={() => navigate("/personas")}
            className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-surface-subtle transition-colors"
          >
            <ItemIcon>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </ItemIcon>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-semibold text-ink">Personas</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">pessoas e negócios nas suas contas</p>
            </div>
            <ChevronRight />
          </button>
        </ListCard>

        {/* Contexto de vida */}
        <SectionTitle>Contexto de vida</SectionTitle>
        <ListCard>
          {[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                </svg>
              ),
              chave: "Meta do ano",
              valor: "—",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="7" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              ),
              chave: "Trabalho",
              valor: "—",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              ),
              chave: "Moradia",
              valor: "—",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" x2="4" y1="22" y2="15" />
                </svg>
              ),
              chave: "Momento",
              valor: "—",
            },
          ].map(({ icon, chave, valor }, i, arr) => (
            <div key={chave}>
              <div className="flex items-center gap-3.5 px-5 py-[15px]">
                <ContextIcon>{icon}</ContextIcon>
                <span className="w-[150px] shrink-0 text-[13px] font-medium text-ink-muted">{chave}</span>
                <span className="flex-1 text-[15px] font-semibold text-ink">{valor}</span>
              </div>
              {i < arr.length - 1 && <Divider />}
            </div>
          ))}
        </ListCard>

        {/* Gostos & jeito */}
        <SectionTitle>Gostos & jeito</SectionTitle>
        <ListCard>
          <div className="flex items-center gap-3.5 px-5 py-[15px]">
            <span className="w-[150px] shrink-0 text-[13px] font-medium text-ink-muted">Vê dinheiro</span>
            <span className="flex-1 text-[15px] font-semibold text-ink">—</span>
          </div>

          <Divider />

          <div className="flex items-center gap-3.5 px-5 py-[15px]">
            <span className="w-[150px] shrink-0 text-[13px] font-medium text-ink-muted">Perfil de risco</span>
            <div className="flex-1">
              <span className="inline-flex items-center h-[26px] px-3 rounded-full bg-positive-50 text-positive-700 text-[13px] font-semibold">
                —
              </span>
            </div>
          </div>

          <Divider />

          <div className="flex items-start gap-3.5 px-5 py-[15px]">
            <span className="w-[150px] shrink-0 text-[13px] font-medium text-ink-muted pt-0.5">Vive pra</span>
            <div className="flex-1 flex flex-wrap gap-2">
              <span className="inline-flex items-center h-[30px] px-3.5 rounded-full bg-surface-subtle text-ink text-[13px] font-semibold">
                —
              </span>
            </div>
          </div>
        </ListCard>
      </div>
    </div>
  );
}
