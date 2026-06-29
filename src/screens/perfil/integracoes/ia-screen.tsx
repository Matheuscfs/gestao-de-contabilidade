import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import claudeLogo from "@/assets/ai/claude.svg";
import geminiLogo from "@/assets/ai/gemini.svg";
import openaiLogo from "@/assets/ai/openai.svg";
import openrouterLogo from "@/assets/ai/openrouter.svg";
import {
  type AiIntegracao,
  type AiProvider,
  type ModeloDisponivel,
  aiAtualizarModelo,
  aiObterIntegracao,
  aiRemoverIntegracao,
  aiSalvarIntegracao,
  aiVerificarChave,
} from "@/core/ipc/ai";

// ─── Metadados dos provedores ──────────────────────────────────────────────────

type ProviderMeta = {
  id: AiProvider;
  nome: string;
  tagline: string;
  logo: string;
  logoBg: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyUrl: string;
  keyUrlLabel: string;
};

const PROVIDERS: ProviderMeta[] = [
  {
    id: "OPENAI",
    nome: "OpenAI · GPT",
    tagline: "Rápido e versátil",
    logo: openaiLogo,
    logoBg: "#F0F0F0",
    keyLabel: "API key",
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    keyUrlLabel: "platform.openai.com",
  },
  {
    id: "ANTHROPIC",
    nome: "Anthropic · Claude",
    tagline: "Raciocínio profundo",
    logo: claudeLogo,
    logoBg: "#FFF1EC",
    keyLabel: "API key",
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyUrlLabel: "console.anthropic.com",
  },
  {
    id: "GOOGLE",
    nome: "Google · Gemini",
    tagline: "Contexto longo",
    logo: geminiLogo,
    logoBg: "#EEF4FF",
    keyLabel: "API key",
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyUrlLabel: "aistudio.google.com",
  },
  {
    id: "OPENROUTER",
    nome: "OpenRouter",
    tagline: "Muitos modelos, uma chave",
    logo: openrouterLogo,
    logoBg: "#F2F2F2",
    keyLabel: "API key",
    keyPlaceholder: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    keyUrlLabel: "openrouter.ai/keys",
  },
];

function metaDe(id: AiProvider): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

// ─── Ícones utilitários ─────────────────────────────────────────────────────--

function IcoFechar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function IcoCadeado() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IcoCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IcoSparkles({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />
    </svg>
  );
}

function LogoProvedor({ meta, size = 38 }: { meta: ProviderMeta; size?: number }) {
  return (
    <div
      className="rounded-[11px] flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: meta.logoBg }}
    >
      <img src={meta.logo} alt={meta.nome} style={{ width: size * 0.55, height: size * 0.55 }} className="object-contain" />
    </div>
  );
}

// ─── Modal: adicionar integração (3 steps) ─────────────────────────────────────

type Step = "provedor" | "credenciais" | "modelo";

function ModalAdicionar({
  onSalvo,
  onFechar,
}: {
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [step, setStep] = useState<Step>("provedor");
  const [provider, setProvider] = useState<AiProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [modelos, setModelos] = useState<ModeloDisponivel[]>([]);
  const [modeloSel, setModeloSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const meta = provider ? metaDe(provider) : null;

  const modelosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return modelos;
    return modelos.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [modelos, busca]);

  async function colar() {
    try {
      setApiKey(await navigator.clipboard.readText());
    } catch {
      /* permissão negada */
    }
  }

  function escolherProvedor(id: AiProvider) {
    setProvider(id);
    setStep("credenciais");
    setErro(null);
  }

  async function verificar() {
    if (!provider || !apiKey.trim()) {
      setErro("Cole a chave antes de verificar.");
      return;
    }
    setVerificando(true);
    setErro(null);
    try {
      const lista = await aiVerificarChave(provider, apiKey.trim());
      if (lista.length === 0) {
        setErro("A chave é válida, mas nenhum modelo está disponível nela.");
        return;
      }
      setModelos(lista);
      setModeloSel(lista[0]?.id ?? null);
      setStep("modelo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setVerificando(false);
    }
  }

  async function salvar() {
    if (!provider || !modeloSel) return;
    setSalvando(true);
    setErro(null);
    try {
      await aiSalvarIntegracao(provider, apiKey.trim(), modeloSel, modelos);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  const passos: { id: Step; label: string }[] = [
    { id: "provedor", label: "Provedor" },
    { id: "credenciais", label: "Chave" },
    { id: "modelo", label: "Modelo" },
  ];
  const stepIdx = passos.findIndex((p) => p.id === step);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(14,17,22,.45)" }}
      onClick={(e) => e.target === e.currentTarget && !salvando && !verificando && onFechar()}
    >
      <div className="w-[520px] bg-surface rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[11px] bg-surface-subtle text-ink-secondary flex items-center justify-center shrink-0">
              <IcoSparkles size={19} />
            </div>
            <h2 className="text-[18px] font-bold text-ink tracking-tight">
              Conectar uma IA
            </h2>
          </div>
          <button
            onClick={onFechar}
            disabled={salvando}
            className="w-8 h-8 rounded-full bg-surface-subtle text-ink-secondary flex items-center justify-center hover:bg-border transition-colors"
          >
            <IcoFechar />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-7 pb-5">
          {passos.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 flex-1">
              <div
                className={[
                  "w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 transition-colors",
                  i < stepIdx
                    ? "bg-brand text-white"
                    : i === stepIdx
                      ? "bg-brand text-white"
                      : "bg-surface-subtle text-ink-muted",
                ].join(" ")}
              >
                {i < stepIdx ? <IcoCheck /> : i + 1}
              </div>
              <span
                className={[
                  "text-[12.5px] font-semibold whitespace-nowrap",
                  i <= stepIdx ? "text-ink" : "text-ink-muted",
                ].join(" ")}
              >
                {p.label}
              </span>
              {i < passos.length - 1 && (
                <div className={`h-px flex-1 ${i < stepIdx ? "bg-brand" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="px-7 pb-7">
          {/* Step 1 — provedor */}
          {step === "provedor" && (
            <>
              <p className="text-[14px] font-medium text-ink-secondary leading-relaxed mb-4">
                Escolha o provedor. Você usa sua própria chave — ela fica só neste computador.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => escolherProvedor(p.id)}
                    className="text-left flex flex-col gap-3 p-4 rounded-2xl border border-border hover:border-brand hover:bg-brand-50/40 transition-colors"
                  >
                    <LogoProvedor meta={p} size={40} />
                    <div>
                      <p className="font-bold text-[14px] text-ink leading-tight">{p.nome}</p>
                      <p className="font-semibold text-[11.5px] text-brand mt-0.5">{p.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2 — credenciais */}
          {step === "credenciais" && meta && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <LogoProvedor meta={meta} size={38} />
                <div>
                  <p className="font-bold text-[15px] text-ink leading-tight">{meta.nome}</p>
                  <p className="text-[12.5px] text-ink-secondary mt-0.5">
                    Pegue sua chave em{" "}
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); open(meta.keyUrl); }}
                      className="text-brand font-semibold hover:underline"
                    >
                      {meta.keyUrlLabel}
                    </a>
                  </p>
                </div>
              </div>

              <label className="block mb-4">
                <span className="block text-[13px] font-semibold text-ink-secondary mb-2">
                  {meta.keyLabel} <span className="font-medium text-ink-placeholder">· secreta</span>
                </span>
                <span className="flex items-center gap-2 h-[50px] px-2 pl-4 bg-surface border border-brand rounded-xl focus-within:ring-2 focus-within:ring-brand/20">
                  <span className="text-ink-muted"><IcoCadeado /></span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={meta.keyPlaceholder}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && verificar()}
                    className="flex-1 min-w-0 border-none outline-none bg-transparent text-[14px] font-semibold text-ink tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={colar}
                    className="h-9 px-3.5 rounded-full bg-surface-subtle text-ink font-semibold text-[13px] hover:bg-border transition-colors shrink-0"
                  >
                    Colar
                  </button>
                </span>
              </label>

              <div className="flex items-start gap-2.5 bg-surface-subtle rounded-xl px-3.5 py-3 mb-4">
                <span className="text-ink-muted mt-0.5"><IcoCadeado /></span>
                <span className="text-[12.5px] font-medium text-ink-secondary leading-snug">
                  Guardamos sua chave criptografada neste computador. Ela nunca sai daqui — só é usada para falar direto com o provedor.
                </span>
              </div>

              {erro && (
                <p className="text-[13px] font-medium text-negative bg-negative/5 rounded-xl px-4 py-3 mb-4">
                  {erro}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("provedor"); setErro(null); }}
                  className="flex-none h-[46px] px-5 rounded-full border border-border bg-surface text-ink font-semibold text-[14px] hover:bg-surface-subtle transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={verificar}
                  disabled={verificando || !apiKey.trim()}
                  className="flex-1 h-[46px] rounded-full bg-brand text-white font-semibold text-[14px] hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {verificando && (
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  )}
                  {verificando ? "Verificando…" : "Verificar integração"}
                </button>
              </div>
            </>
          )}

          {/* Step 3 — modelo */}
          {step === "modelo" && meta && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <LogoProvedor meta={meta} size={38} />
                <div>
                  <p className="font-bold text-[15px] text-ink leading-tight">{meta.nome}</p>
                  <p className="text-[12.5px] text-positive font-semibold mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
                    chave válida · {modelos.length} {modelos.length === 1 ? "modelo" : "modelos"} disponíveis
                  </p>
                </div>
              </div>

              {modelos.length > 6 && (
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar modelo…"
                  className="w-full h-10 px-3.5 mb-2.5 bg-surface-subtle border border-border rounded-xl text-[13.5px] text-ink outline-none focus:border-brand"
                />
              )}

              <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border divide-y divide-border-subtle">
                {modelosFiltrados.map((m) => {
                  const ativo = modeloSel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setModeloSel(m.id)}
                      className={[
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        ativo ? "bg-brand-50/60" : "hover:bg-surface-subtle",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0",
                          ativo ? "border-brand bg-brand text-white" : "border-border-strong",
                        ].join(" ")}
                      >
                        {ativo && <IcoCheck />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-ink truncate">{m.label}</span>
                        {m.label !== m.id && (
                          <span className="block text-[12px] text-ink-muted truncate">{m.id}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {modelosFiltrados.length === 0 && (
                  <div className="px-4 py-6 text-center text-[13px] text-ink-muted">
                    Nenhum modelo encontrado.
                  </div>
                )}
              </div>

              {erro && (
                <p className="text-[13px] font-medium text-negative bg-negative/5 rounded-xl px-4 py-3 mt-4">
                  {erro}
                </p>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setStep("credenciais"); setErro(null); }}
                  disabled={salvando}
                  className="flex-none h-[46px] px-5 rounded-full border border-border bg-surface text-ink font-semibold text-[14px] hover:bg-surface-subtle transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvando || !modeloSel}
                  className="flex-1 h-[46px] rounded-full bg-brand text-white font-semibold text-[14px] hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {salvando ? "Salvando…" : "Salvar integração"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: gerenciar (trocar modelo / desconectar) ─────────────────────────────

function ModalGerenciar({
  integracao,
  onTrocarModelo,
  onDesconectado,
  onFechar,
}: {
  integracao: AiIntegracao;
  onTrocarModelo: (model: string) => Promise<void>;
  onDesconectado: () => void;
  onFechar: () => void;
}) {
  const meta = metaDe(integracao.provider);
  const [modeloSel, setModeloSel] = useState<string | null>(integracao.model);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const modelosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return integracao.modelos;
    return integracao.modelos.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [integracao.modelos, busca]);

  async function salvar() {
    if (!modeloSel) return;
    setSalvando(true);
    setErro(null);
    try {
      await onTrocarModelo(modeloSel);
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  async function desconectar() {
    setRemovendo(true);
    setErro(null);
    try {
      await aiRemoverIntegracao();
      onDesconectado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setRemovendo(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(14,17,22,.45)" }}
      onClick={(e) => e.target === e.currentTarget && !salvando && !removendo && onFechar()}
    >
      <div className="w-[480px] bg-surface rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <LogoProvedor meta={meta} size={38} />
            <h2 className="text-[18px] font-bold text-ink tracking-tight">Gerenciar IA</h2>
          </div>
          <button
            onClick={onFechar}
            disabled={salvando || removendo}
            className="w-8 h-8 rounded-full bg-surface-subtle text-ink-secondary flex items-center justify-center hover:bg-border transition-colors"
          >
            <IcoFechar />
          </button>
        </div>

        <div className="px-7 pb-7">
          <p className="text-[13px] font-semibold text-ink-secondary mb-2">Modelo em uso</p>

          {integracao.modelos.length > 6 && (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar modelo…"
              className="w-full h-10 px-3.5 mb-2.5 bg-surface-subtle border border-border rounded-xl text-[13.5px] text-ink outline-none focus:border-brand"
            />
          )}

          <div className="max-h-[240px] overflow-y-auto rounded-xl border border-border divide-y divide-border-subtle">
            {modelosFiltrados.map((m) => {
              const ativo = modeloSel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setModeloSel(m.id)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                    ativo ? "bg-brand-50/60" : "hover:bg-surface-subtle",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0",
                      ativo ? "border-brand bg-brand text-white" : "border-border-strong",
                    ].join(" ")}
                  >
                    {ativo && <IcoCheck />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-ink truncate">{m.label}</span>
                    {m.label !== m.id && (
                      <span className="block text-[12px] text-ink-muted truncate">{m.id}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {erro && (
            <p className="text-[13px] font-medium text-negative bg-negative/5 rounded-xl px-4 py-3 mt-4">
              {erro}
            </p>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={desconectar}
              disabled={removendo || salvando}
              className="flex-none h-[46px] px-5 rounded-full border border-negative/30 bg-negative/5 text-negative font-semibold text-[14px] hover:bg-negative/10 transition-colors"
            >
              {removendo ? "Removendo…" : "Desconectar"}
            </button>
            <button
              onClick={salvar}
              disabled={salvando || removendo || modeloSel === integracao.model}
              className="flex-1 h-[46px] rounded-full bg-brand text-white font-semibold text-[14px] hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar modelo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tela principal ─────────────────────────────────────────────────────────--

type Estado = "carregando" | "nao-configurado" | "configurado";

export function IaIntegracaoScreen() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [integracao, setIntegracao] = useState<AiIntegracao | null>(null);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [modalGerenciar, setModalGerenciar] = useState(false);

  async function carregar() {
    try {
      const atual = await aiObterIntegracao();
      setIntegracao(atual);
      setEstado(atual ? "configurado" : "nao-configurado");
    } catch {
      setEstado("nao-configurado");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleSalvo() {
    setModalAdicionar(false);
    await carregar();
  }

  async function handleTrocarModelo(model: string) {
    // A chave não volta para a UI — o backend troca só o modelo, preservando-a.
    await aiAtualizarModelo(model);
    await carregar();
  }

  async function handleDesconectado() {
    setModalGerenciar(false);
    setIntegracao(null);
    setEstado("nao-configurado");
  }

  const meta = integracao ? metaDe(integracao.provider) : null;
  const modeloLabel =
    integracao?.modelos.find((m) => m.id === integracao.model)?.label ?? integracao?.model ?? "—";

  return (
    <div className="animate-fade-in w-full max-w-[720px] mx-auto pt-1.5">
      {/* Cabeçalho */}
      <div className="px-0.5">
        <h1 className="text-[24px] font-bold text-ink tracking-[-0.02em]">
          IA do seu jeito
        </h1>
        <p className="text-[15px] font-medium text-ink-secondary mt-1.5">
          Conecte um provedor com sua própria chave. A IA lê seu mês com o seu contexto — e tudo fica neste computador.
        </p>
      </div>

      {estado === "carregando" && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      )}

      {/* Não configurado */}
      {estado === "nao-configurado" && (
        <div className="flex items-center gap-[18px] bg-surface border border-border rounded-2xl px-6 py-5 mt-[18px]">
          <div className="w-[54px] h-[54px] rounded-[14px] bg-surface-subtle text-ink-secondary flex items-center justify-center shrink-0">
            <IcoSparkles size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold text-ink">Nenhuma IA conectada</p>
            <p className="text-[13px] font-medium text-ink-secondary mt-1">
              conecte OpenAI, Claude, Gemini ou OpenRouter para liberar os insights
            </p>
          </div>
          <button
            onClick={() => setModalAdicionar(true)}
            className="h-[42px] px-[18px] rounded-full bg-brand text-white font-semibold text-sm hover:bg-brand-600 transition-colors shrink-0"
          >
            Adicionar
          </button>
        </div>
      )}

      {/* Configurado */}
      {estado === "configurado" && integracao && meta && (
        <>
          <div className="bg-surface border border-border rounded-2xl px-6 py-5 mt-[18px] flex items-center gap-[18px]">
            <LogoProvedor meta={meta} size={54} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <p className="text-[16px] font-bold text-ink">{meta.nome}</p>
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-positive-50 text-positive-700 font-semibold text-[12px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
                  ativa
                </span>
              </div>
              <p className="text-[13px] font-medium text-ink-secondary mt-1">
                modelo: <span className="font-semibold text-ink">{modeloLabel}</span>
              </p>
            </div>
            <button
              onClick={() => setModalGerenciar(true)}
              className="h-[40px] px-4 rounded-full border border-border-strong bg-surface text-ink font-semibold text-sm hover:bg-surface-subtle transition-colors shrink-0"
            >
              Gerenciar
            </button>
          </div>

          <div className="bg-surface border border-border rounded-2xl px-6 py-4 mt-3 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-muted">
              Só uma IA por vez. Para trocar de provedor, desconecte e adicione outra.
            </span>
          </div>
        </>
      )}

      {/* Modais */}
      {modalAdicionar && (
        <ModalAdicionar onSalvo={handleSalvo} onFechar={() => setModalAdicionar(false)} />
      )}
      {modalGerenciar && integracao && (
        <ModalGerenciar
          integracao={integracao}
          onTrocarModelo={handleTrocarModelo}
          onDesconectado={handleDesconectado}
          onFechar={() => setModalGerenciar(false)}
        />
      )}
    </div>
  );
}
