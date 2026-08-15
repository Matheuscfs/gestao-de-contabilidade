import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

// ─── Configurações ────────────────────────────────────────────────────────────
//
// A tela lista o que o app realmente oferece hoje. As seções que ainda não
// existem ficam explicitamente marcadas como indisponíveis em vez de virarem
// botões que não fazem nada — um botão mudo passa a impressão de app quebrado.
// ─────────────────────────────────────────────────────────────────────────────

type Secao = {
  label: string;
  desc: string;
  /** Ação disponível hoje. Ausente = seção ainda não implementada. */
  acao?: () => void;
};

export function ConfiguracoesScreen() {
  const navigate = useNavigate();
  const [versao, setVersao] = useState<string | null>(null);
  const [caminhoBanco, setCaminhoBanco] = useState<string | null>(null);
  const [sobreAberto, setSobreAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    invoke<string>("app_version").then(setVersao).catch(() => setVersao(null));
    invoke<string>("db_path").then(setCaminhoBanco).catch(() => setCaminhoBanco(null));
  }, []);

  async function copiarCaminho() {
    if (!caminhoBanco) return;
    try {
      await navigator.clipboard.writeText(caminhoBanco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* permissão negada — o caminho continua visível para cópia manual */
    }
  }

  const secoes: Secao[] = [
    {
      label: "Preferências gerais",
      desc: "Idioma, moeda e formato de data",
    },
    {
      label: "Notificações",
      desc: "Alertas de vencimento e confirmações pendentes",
    },
    {
      label: "Dados e privacidade",
      desc: "Exportar ou apagar seus dados locais",
      acao: () => navigate("/perfil"),
    },
    {
      label: "Sobre o Quibo",
      desc: "Versão, licença e informações técnicas",
      acao: () => setSobreAberto((v) => !v),
    },
  ];

  return (
    <div className="animate-fade-in max-w-xl">
      <div className="space-y-3">
        {secoes.map(({ label, desc, acao }) => (
          <div key={label}>
            <button
              onClick={acao}
              disabled={!acao}
              className={[
                "w-full flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4 transition-colors group",
                acao
                  ? "hover:bg-surface-subtle cursor-pointer"
                  : "opacity-60 cursor-default",
              ].join(" ")}
            >
              <div className="text-left">
                <p className="text-[15px] font-semibold text-ink">{label}</p>
                <p className="text-sm text-ink-muted mt-0.5">{desc}</p>
              </div>
              {acao ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={[
                    "text-ink-muted group-hover:text-ink transition-transform shrink-0",
                    label === "Sobre o Quibo" && sobreAberto ? "rotate-90" : "",
                  ].join(" ")}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              ) : (
                <span className="text-xs font-semibold text-ink-muted bg-surface-subtle border border-border-subtle rounded-full px-2.5 py-1 shrink-0">
                  em breve
                </span>
              )}
            </button>

            {label === "Sobre o Quibo" && sobreAberto && (
              <div className="mt-2 bg-surface border border-border rounded-xl px-5 py-4 space-y-3">
                <Linha rotulo="Versão" valor={versao ?? "—"} />
                <Linha rotulo="Licença" valor="Uso pessoal" />
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                    Banco de dados local
                  </p>
                  <p className="text-[13px] text-ink mt-1 break-all font-mono">
                    {caminhoBanco ?? "—"}
                  </p>
                  {caminhoBanco && (
                    <button
                      onClick={copiarCaminho}
                      className="mt-2 text-[13px] font-semibold text-brand hover:underline"
                    >
                      {copiado ? "Caminho copiado" : "Copiar caminho"}
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-ink-secondary leading-relaxed">
                  Seus dados ficam só nesta máquina, nesse arquivo. Não há
                  servidor: as integrações usam as suas próprias chaves.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-secondary">{rotulo}</span>
      <span className="text-sm font-semibold text-ink tabular-nums">{valor}</span>
    </div>
  );
}
