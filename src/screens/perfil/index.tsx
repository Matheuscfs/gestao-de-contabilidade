import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePerfilStore } from "@/app/perfil-store";
import { getSetting, setSetting, deleteSetting } from "@/core/db/settings";
import { getDb } from "@/core/db/client";
import {
  transactions,
  goals,
  integrationSyncLog,
  integrations,
  accounts,
  creditCards,
  personas,
  categories,
  appSettings,
} from "@/core/db/schema";
import { semearSeNecessario } from "@/core/db/seed";
import { sincronizarPersonaPrincipal } from "@/core/db/personas";

// ─── Chaves de configuração de contexto de vida ───────────────────────────────

const CHAVE_META = "contexto_meta";
const CHAVE_TRABALHO = "contexto_trabalho";
const CHAVE_MOMENTO = "contexto_momento";
const CHAVE_INVESTIMENTOS = "contexto_investimentos";

// ─── Ícones utilitários ───────────────────────────────────────────────────────

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

function IcoLapiz() {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function IcoCheck() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IcoX() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IcoFechar() {
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

function IcoAlerta() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// ─── Componentes de layout ────────────────────────────────────────────────────

function ItemIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[38px] h-[38px] rounded-[11px] bg-surface-subtle text-ink-secondary flex items-center justify-center shrink-0">
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

// ─── Linha de item de contexto de vida ───────────────────────────────────────

function LinhaContexto({
  icon,
  chave,
  valor,
  placeholder,
  onSalvar,
}: {
  icon: React.ReactNode;
  chave: string;
  valor: string;
  placeholder: string;
  onSalvar: (novoValor: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [valorTemp, setValorTemp] = useState("");
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function abrirEdicao() {
    setValorTemp(valor === "—" ? "" : valor);
    setEditando(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar(valorTemp.trim());
    } finally {
      setSalvando(false);
      setEditando(false);
    }
  }

  function cancelar() {
    setEditando(false);
    setValorTemp("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") salvar();
    if (e.key === "Escape") cancelar();
  }

  return (
    <div className="flex items-center gap-3.5 px-5 py-[15px] min-h-[60px]">
      <div className="w-9 h-9 rounded-[10px] bg-surface-subtle text-ink-secondary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="w-[140px] shrink-0 text-[13px] font-medium text-ink-muted">
        {chave}
      </span>

      {editando ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            value={valorTemp}
            onChange={(e) => setValorTemp(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={salvando}
            className="flex-1 min-w-0 bg-surface-subtle border border-brand rounded-lg px-3 py-1.5 text-[14px] font-semibold text-ink outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button
            onClick={salvar}
            disabled={salvando}
            className="w-8 h-8 rounded-lg bg-positive-50 text-positive-700 flex items-center justify-center hover:bg-positive-100 transition-colors shrink-0"
          >
            <IcoCheck />
          </button>
          <button
            onClick={cancelar}
            className="w-8 h-8 rounded-lg bg-surface-subtle text-ink-secondary flex items-center justify-center hover:bg-border transition-colors shrink-0"
          >
            <IcoX />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-[15px] font-semibold text-ink">
            {valor}
          </span>
          <button
            onClick={abrirEdicao}
            className="w-8 h-8 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink-secondary flex items-center justify-center transition-colors shrink-0"
            aria-label={`Editar ${chave}`}
          >
            <IcoLapiz />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Modal: Área de perigo ────────────────────────────────────────────────────

function ModalAreaDePerigo({ onFechar }: { onFechar: () => void }) {
  const navigate = useNavigate();
  const [acao, setAcao] = useState<"limpar" | "redefinir" | null>(null);
  const [executando, setExecutando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executarLimparDados() {
    setExecutando(true);
    setErro(null);
    try {
      const db = await getDb();

      // Remove dados transacionais preservando as configurações de perfil
      await db.delete(integrationSyncLog);
      await db.delete(integrations);
      await db.delete(transactions);
      await db.delete(goals);
      await db.delete(accounts);
      await db.delete(creditCards);
      await db.delete(personas);
      await db.delete(categories);

      // Remove contexto de vida
      await Promise.all([
        deleteSetting(CHAVE_META),
        deleteSetting(CHAVE_TRABALHO),
        deleteSetting(CHAVE_MOMENTO),
        deleteSetting(CHAVE_INVESTIMENTOS),
      ]);

      // Repopula dados base (persona principal, conta e categorias)
      await semearSeNecessario();

      // O nome/foto do perfil são preservados — reaplica-os na persona principal
      // recém-recriada (o seed a cria provisoriamente como "Você").
      const { nome, foto } = usePerfilStore.getState();
      if (nome) await sincronizarPersonaPrincipal({ name: nome, avatar: foto });

      onFechar();
      navigate("/");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao limpar dados.");
    } finally {
      setExecutando(false);
    }
  }

  async function executarRedefinirTudo() {
    setExecutando(true);
    setErro(null);
    try {
      const db = await getDb();

      // Remove tudo do banco
      await db.delete(integrationSyncLog);
      await db.delete(integrations);
      await db.delete(transactions);
      await db.delete(goals);
      await db.delete(accounts);
      await db.delete(creditCards);
      await db.delete(personas);
      await db.delete(categories);
      await db.delete(appSettings);

      // Limpa localStorage
      localStorage.removeItem("quibo:onboarding_done");
      localStorage.removeItem("quibo:nome_usuario");
      localStorage.removeItem("quibo:foto_usuario");

      // Reseta estado do perfil em memória
      usePerfilStore.setState({
        nome: "",
        foto: null,
        iniciais: "",
        focos: [],
        focoFrase: "",
      });

      // Redireciona para onboarding
      navigate("/onboarding/boas-vindas");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao redefinir o app.");
    } finally {
      setExecutando(false);
    }
  }

  function handleConfirmar() {
    if (acao === "limpar") executarLimparDados();
    else if (acao === "redefinir") executarRedefinirTudo();
  }

  const textoConfirmacao = {
    limpar: {
      titulo: "Limpar todos os dados?",
      descricao:
        "Seus lançamentos, contas, dívidas, compromissos e integrações serão apagados. Seu nome e foto ficam. O Gestão de Contabilidade volta ao estado inicial — só as categorias e conta padrão permanecem.",
      botao: "Sim, limpar dados",
      corBotao: "bg-[#E8A020] hover:bg-[#CC8B18]",
    },
    redefinir: {
      titulo: "Redefinir tudo?",
      descricao:
        "Tudo será apagado: dados, configurações, perfil e histórico. O Gestão de Contabilidade volta à tela inicial como se fosse instalado agora. Essa ação não tem volta.",
      botao: "Sim, redefinir tudo",
      corBotao: "bg-negative hover:bg-red-700",
    },
  };

  const confirmacao = acao ? textoConfirmacao[acao] : null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(14,17,22,.45)" }}
      onClick={(e) => e.target === e.currentTarget && !executando && onFechar()}
    >
      <div className="w-[480px] bg-surface rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-negative/10 text-negative flex items-center justify-center shrink-0">
              <IcoAlerta />
            </div>
            <h2 className="text-[19px] font-bold text-ink tracking-tight">
              Área de perigo
            </h2>
          </div>
          <button
            onClick={onFechar}
            disabled={executando}
            className="w-8 h-8 rounded-full bg-surface-subtle text-ink-secondary flex items-center justify-center hover:bg-border transition-colors"
          >
            <IcoFechar />
          </button>
        </div>

        <div className="px-7 pb-7">
          {/* Tela de seleção */}
          {!acao && (
            <>
              <p className="text-[14px] font-medium text-ink-secondary leading-relaxed mb-5">
                Escolha o que deseja fazer. Essas ações são irreversíveis — leia com atenção antes de continuar.
              </p>

              <div className="flex flex-col gap-3">
                {/* Limpar dados */}
                <button
                  onClick={() => setAcao("limpar")}
                  className="w-full text-left flex items-start gap-4 p-4 rounded-2xl border border-border hover:border-[#E8A020]/50 hover:bg-[#FFF8EC] transition-colors group"
                >
                  <div className="w-9 h-9 rounded-[10px] bg-[#FFF3D6] text-[#E8A020] flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" x2="10" y1="11" y2="17" />
                      <line x1="14" x2="14" y1="11" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">Limpar dados</p>
                    <p className="text-[13px] text-ink-secondary mt-1 leading-relaxed">
                      Remove todos os lançamentos e integrações. Seu nome e foto ficam. O app vai para o dashboard.
                    </p>
                  </div>
                </button>

                {/* Redefinir tudo */}
                <button
                  onClick={() => setAcao("redefinir")}
                  className="w-full text-left flex items-start gap-4 p-4 rounded-2xl border border-border hover:border-negative/30 hover:bg-negative/5 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-[10px] bg-negative/10 text-negative flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M8 16H3v5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">Redefinir tudo</p>
                    <p className="text-[13px] text-ink-secondary mt-1 leading-relaxed">
                      Apaga tudo — dados, perfil e configurações — e reinicia o app do zero, como se fosse a primeira vez.
                    </p>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Tela de confirmação */}
          {acao && confirmacao && (
            <>
              <p className="text-[14px] font-medium text-ink-secondary leading-relaxed mb-5">
                {confirmacao.descricao}
              </p>

              {erro && (
                <p className="text-[13px] font-medium text-negative bg-negative/5 rounded-xl px-4 py-3 mb-4">
                  {erro}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setAcao(null); setErro(null); }}
                  disabled={executando}
                  className="flex-none h-[46px] px-5 rounded-full border border-border bg-surface text-ink font-semibold text-[14px] hover:bg-surface-subtle transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={executando}
                  className={`flex-1 h-[46px] rounded-full text-white font-semibold text-[14px] transition-colors ${confirmacao.corBotao} disabled:opacity-60`}
                >
                  {executando ? "Aguarde…" : confirmacao.botao}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function PerfilScreen() {
  const navigate = useNavigate();
  const { nome, foto, iniciais } = usePerfilStore();

  const [meta, setMeta] = useState("—");
  const [trabalho, setTrabalho] = useState("—");
  const [momento, setMomento] = useState("—");
  const [investimentos, setInvestimentos] = useState("—");
  const [modalPerigoAberto, setModalPerigoAberto] = useState(false);

  useEffect(() => {
    async function carregarContexto() {
      const [metaVal, trabalhoVal, momentoVal, investimentosVal] =
        await Promise.all([
          getSetting(CHAVE_META),
          getSetting(CHAVE_TRABALHO),
          getSetting(CHAVE_MOMENTO),
          getSetting(CHAVE_INVESTIMENTOS),
        ]);
      if (metaVal) setMeta(metaVal);
      if (trabalhoVal) setTrabalho(trabalhoVal);
      if (momentoVal) setMomento(momentoVal);
      if (investimentosVal) setInvestimentos(investimentosVal);
    }
    carregarContexto();
  }, []);

  async function salvarContexto(
    chave: string,
    setter: (v: string) => void,
    novoValor: string
  ) {
    const valorFinal = novoValor || "—";
    setter(valorFinal);
    if (novoValor.trim()) {
      await setSetting(chave, novoValor.trim());
    } else {
      await deleteSetting(chave);
    }
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="max-w-[720px] mx-auto">
        {/* Card do usuário */}
        <div className="bg-surface border border-border rounded-2xl px-6 py-5 flex items-center gap-[18px]">
          <div className="w-[68px] h-[68px] rounded-full overflow-hidden shrink-0">
            {foto ? (
              <img
                src={foto}
                alt={nome || "Perfil"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-brand-50 text-brand flex items-center justify-center font-bold text-2xl">
                {iniciais || "?"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[22px] font-bold text-ink tracking-tight">
              {nome || "Seu nome"}
            </p>
            <p className="text-sm text-ink-secondary mt-0.5">
              no Gestão de Contabilidade desde hoje
            </p>
          </div>
          <button className="h-[42px] px-[18px] rounded-full border border-border-strong bg-surface text-ink text-sm font-semibold hover:bg-surface-subtle transition-colors shrink-0">
            Editar
          </button>
        </div>

        {/* ── Gerenciar ─────────────────────────────────────────────────────── */}
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

          <Divider />

          <button
            onClick={() => navigate("/integracoes/ia")}
            className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-surface-subtle transition-colors"
          >
            <ItemIcon>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                <path d="M20 3v4" />
                <path d="M22 5h-4" />
                <path d="M4 17v2" />
                <path d="M5 18H3" />
              </svg>
            </ItemIcon>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-semibold text-ink">Integração com IA</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">configure o conselheiro financeiro</p>
            </div>
            <ChevronRight />
          </button>

          <Divider />

          <button
            onClick={() => navigate("/integracoes/pluggy")}
            className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-surface-subtle transition-colors"
          >
            <ItemIcon>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" x2="21" y1="22" y2="22" />
                <line x1="6" x2="6" y1="18" y2="11" />
                <line x1="10" x2="10" y1="18" y2="11" />
                <line x1="14" x2="14" y1="18" y2="11" />
                <line x1="18" x2="18" y1="18" y2="11" />
                <polygon points="12 2 20 7 4 7" />
              </svg>
            </ItemIcon>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[15px] font-semibold text-ink">Open Finance by Pluggy</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">importar lançamentos reais dos seus bancos</p>
            </div>
            <ChevronRight />
          </button>
        </ListCard>

        {/* ── Contexto de vida ─────────────────────────────────────────────── */}
        <SectionTitle>Contexto de vida</SectionTitle>
        <ListCard>
          <LinhaContexto
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            }
            chave="Meta"
            valor={meta}
            placeholder="Ex.: viagem para o Japão em 2026"
            onSalvar={(v) => salvarContexto(CHAVE_META, setMeta, v)}
          />

          <Divider />

          <LinhaContexto
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="7" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            }
            chave="Trabalho"
            valor={trabalho}
            placeholder="Ex.: desenvolvedor freelancer"
            onSalvar={(v) => salvarContexto(CHAVE_TRABALHO, setTrabalho, v)}
          />

          <Divider />

          <LinhaContexto
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            }
            chave="Momento"
            valor={momento}
            placeholder="Ex.: recém-casado, morando sozinho"
            onSalvar={(v) => salvarContexto(CHAVE_MOMENTO, setMomento, v)}
          />

          <Divider />

          <LinhaContexto
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            }
            chave="Investimento(s)"
            valor={investimentos}
            placeholder="Ex.: Tesouro Direto, ações"
            onSalvar={(v) => salvarContexto(CHAVE_INVESTIMENTOS, setInvestimentos, v)}
          />
        </ListCard>

        {/* ── Área de perigo ─────────────────────────────────────────────────── */}
        <SectionTitle>Área de perigo</SectionTitle>
        <div className="bg-surface border border-negative/20 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-[38px] h-[38px] rounded-[11px] bg-negative/10 text-negative flex items-center justify-center shrink-0">
              <IcoAlerta />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink">Ações irreversíveis</p>
              <p className="text-[13px] text-ink-secondary mt-0.5">
                limpar dados ou redefinir o app por completo
              </p>
            </div>
            <button
              onClick={() => setModalPerigoAberto(true)}
              className="h-[38px] px-4 rounded-full border border-negative/30 bg-negative/5 text-negative text-[13px] font-semibold hover:bg-negative/10 transition-colors shrink-0"
            >
              Abrir
            </button>
          </div>
        </div>

        {/* Espaçamento inferior */}
        <div className="h-6" />
      </div>

      {/* Modal área de perigo */}
      {modalPerigoAberto && (
        <ModalAreaDePerigo onFechar={() => setModalPerigoAberto(false)} />
      )}
    </div>
  );
}
