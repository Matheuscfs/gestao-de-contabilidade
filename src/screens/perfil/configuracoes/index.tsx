export function ConfiguracoesScreen() {
  return (
    <div className="animate-fade-in max-w-xl">
      <div className="space-y-3">
        {[
          { label: "Preferências gerais", desc: "Idioma, moeda e formato de data" },
          { label: "Notificações", desc: "Alertas de vencimento e confirmações pendentes" },
          { label: "Dados e privacidade", desc: "Exportar ou apagar seus dados locais" },
          { label: "Sobre o Quibo", desc: "Versão, licença e informações técnicas" },
        ].map(({ label, desc }) => (
          <button
            key={label}
            className="w-full flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4 hover:bg-surface-subtle transition-colors group"
          >
            <div className="text-left">
              <p className="text-[15px] font-semibold text-ink">{label}</p>
              <p className="text-sm text-ink-muted mt-0.5">{desc}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted group-hover:text-ink transition-colors shrink-0">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
