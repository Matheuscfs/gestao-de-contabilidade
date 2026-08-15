import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMesStore } from "@/app/mes-store";
import { tratarErro } from "@/core/errors";
import {
  type AiIntegracao,
  type MensagemChat,
  aiConversar,
  aiObterIntegracao,
} from "@/core/ipc/ai";

// ─── Tela IA ──────────────────────────────────────────────────────────────────
//
// Chat com o modelo que o usuário configurou (BYOK). Não há nada simulado aqui:
// ou existe uma chave configurada e a conversa funciona de verdade, ou a tela
// convida a configurar. Insight ou número que não veio do modelo não aparece.
//
// O contexto financeiro é montado no Rust (ai/contexto.rs), respeitando as
// permissões da integração. Daqui só sai a competência em foco.
// ─────────────────────────────────────────────────────────────────────────────

const SUGESTOES = [
  "Como foi meu mês?",
  "Onde eu mais gastei?",
  "Tem alguma fatura para pagar?",
  "Dá para economizar em quê?",
];

/** Nome amigável do provedor, só para exibição. */
const PROVEDOR_LABEL: Record<string, string> = {
  ANTHROPIC: "Anthropic",
  OPENAI: "OpenAI",
  GOOGLE: "Google",
  OPENROUTER: "OpenRouter",
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function IaScreen() {
  const { mes, ano } = useMesStore();

  const [carregando, setCarregando] = useState(true);
  const [integracao, setIntegracao] = useState<AiIntegracao | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fimDaListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    aiObterIntegracao()
      .then((i) => {
        if (ativo) setIntegracao(i);
      })
      .catch((e) =>
        tratarErro(e, {
          contexto: "carregar integração de IA",
          mensagemUsuario: "Não foi possível verificar a IA configurada.",
        })
      )
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, pensando]);

  const configurada = Boolean(integracao?.model);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || pensando) return;

    const historico: MensagemChat[] = [
      ...mensagens,
      { papel: "user", texto: pergunta },
    ];
    setMensagens(historico);
    setRascunho("");
    setErro(null);
    setPensando(true);

    try {
      const resposta = await aiConversar(historico, mes, ano);
      setMensagens([...historico, { papel: "assistant", texto: resposta.texto }]);
    } catch (e) {
      // A mensagem do Rust já vem pronta para o usuário (chave inválida, sem
      // crédito, rede fora). Fica visível na tela, não só num toast que some.
      setErro(
        tratarErro(e, { contexto: "conversar com a IA", notificar: false })
      );
    } finally {
      setPensando(false);
    }
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar(rascunho);
    }
  }

  if (carregando) {
    return (
      <div className="animate-fade-in flex items-center justify-center" style={{ minHeight: 320 }}>
        <p className="text-sm text-ink-muted">Carregando…</p>
      </div>
    );
  }

  if (!configurada) {
    return <SemChaveConfigurada />;
  }

  const modelo = integracao?.model ?? "";
  const provedor = PROVEDOR_LABEL[integracao?.provider ?? ""] ?? integracao?.provider ?? "";

  return (
    <div className="animate-fade-in flex flex-col" style={{ minHeight: 480 }}>
      {/* Cabeçalho: quem responde e sobre qual mês */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex h-6 items-center px-2.5 rounded-full bg-brand-50 border border-brand-100 text-xs font-semibold text-brand">
          {provedor} · {modelo}
        </span>
        <span className="inline-flex h-6 items-center px-2.5 rounded-full bg-surface-subtle border border-border text-xs font-semibold text-ink-secondary">
          Contexto: {MESES[mes - 1]} de {ano}
        </span>
        {mensagens.length > 0 && (
          <button
            onClick={() => {
              setMensagens([]);
              setErro(null);
            }}
            className="ml-auto text-xs font-semibold text-ink-secondary hover:text-ink"
          >
            Limpar conversa
          </button>
        )}
      </div>

      {/* Histórico */}
      <div className="flex-1 bg-surface border border-border rounded-xl p-5 overflow-y-auto" style={{ minHeight: 320 }}>
        {mensagens.length === 0 && !pensando ? (
          <ConversaVazia aoEscolher={(s) => void enviar(s)} />
        ) : (
          <div className="space-y-4">
            {mensagens.map((m, i) => (
              <Balao key={i} mensagem={m} />
            ))}
            {pensando && (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                Pensando…
              </div>
            )}
            <div ref={fimDaListaRef} />
          </div>
        )}
      </div>

      {/* Erro visível — não some sozinho */}
      {erro && (
        <div className="mt-3 flex items-start gap-3 bg-negative-50 border border-negative-100 rounded-xl px-4 py-3">
          <p className="flex-1 text-sm text-negative">{erro}</p>
          <button
            onClick={() => setErro(null)}
            className="shrink-0 text-xs font-semibold text-negative hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Campo de envio */}
      <div className="mt-3 flex items-end gap-3 bg-surface border border-border rounded-xl px-4 py-3">
        <textarea
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={aoTeclar}
          rows={1}
          placeholder="Pergunte algo sobre seu dinheiro…"
          disabled={pensando}
          className="flex-1 min-w-0 resize-none border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder disabled:opacity-60"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={() => void enviar(rascunho)}
          disabled={pensando || rascunho.trim().length === 0}
          aria-label="Enviar pergunta"
          className="shrink-0 w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center transition-opacity disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
          </svg>
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        A IA narra os números que o Gestão de Contabilidade calculou — ela não recalcula nada. Confira sempre no Extrato.
      </p>
    </div>
  );
}

// ─── Blocos ───────────────────────────────────────────────────────────────────

function Balao({ mensagem }: { mensagem: MensagemChat }) {
  const doUsuario = mensagem.papel === "user";
  return (
    <div className={doUsuario ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap break-words",
          doUsuario
            ? "bg-brand text-white"
            : "bg-surface-subtle border border-border text-ink",
        ].join(" ")}
      >
        {mensagem.texto}
      </div>
    </div>
  );
}

function ConversaVazia({ aoEscolher }: { aoEscolher: (texto: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-8">
      <p className="text-sm text-ink-secondary max-w-sm">
        Pergunte sobre o seu dinheiro. A resposta usa os dados do mês selecionado,
        dentro do que você autorizou nas integrações.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            onClick={() => aoEscolher(s)}
            className="h-8 px-3 rounded-full bg-surface-subtle border border-border text-xs font-semibold text-ink-secondary hover:text-ink hover:border-brand-100 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function SemChaveConfigurada() {
  return (
    <div className="animate-fade-in">
      <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
          </svg>
        </div>
        <p className="text-[15px] font-semibold text-ink">Nenhuma IA configurada</p>
        <p className="text-sm text-ink-secondary max-w-md">
          A IA usa a sua própria chave — Anthropic, OpenAI, Google ou OpenRouter.
          Ela fica só no seu computador e é usada apenas para responder às suas perguntas.
        </p>
        <Link
          to="/integracoes/ia"
          className="mt-2 inline-flex h-9 items-center px-4 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Configurar em Integrações → IA
        </Link>
      </div>
    </div>
  );
}
