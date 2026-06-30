import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  type ItemResumo,
  type ResultadoSync,
  pluggyDescobrirItems,
  pluggyIniciarConexao,
  pluggyListarItems,
  pluggyRegistrarItem,
  pluggyRemoverCredenciais,
  pluggySalvarCredenciais,
  pluggySincronizarItem,
  pluggySincronizarTodos,
  pluggyStatusCredenciais,
} from "@/core/ipc/pluggy";
import { toast } from "@/components/toast";

// ─── Logo Pluggy (SVG oficial) ────────────────────────────────────────────────

function PluggyLogo() {
  return (
    <svg width="112" height="22" viewBox="0 0 163 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M86.6216 22.4865H90.0811V0H86.6216V22.4865Z" fill="#EF294B" />
      <path fillRule="evenodd" clipRule="evenodd" d="M96.5675 14.9358C96.5675 17.2663 97.8755 19.0374 100.363 19.0374C102.756 19.0374 104.383 17.0801 104.383 14.7494V6.91895H108.243V22.269H104.766L104.511 20.1874C102.884 21.7406 101.385 22.4865 99.1833 22.4865C95.4191 22.4865 92.6757 19.7213 92.6757 14.9672V6.91895H96.5675V14.9358Z" fill="#EF294B" />
      <path fillRule="evenodd" clipRule="evenodd" d="M114.59 14.1363C114.59 16.846 116.389 18.4525 118.591 18.4525C120.761 18.4525 122.56 16.8144 122.56 14.1363C122.56 11.4585 120.761 9.75724 118.591 9.75724C116.389 9.75724 114.59 11.4272 114.59 14.1363ZM126.405 7.3315L124.7 9.53673C125.878 10.8914 126.312 12.4351 126.312 14.1363C126.312 16.0579 125.599 18.7675 123.087 19.9335C125.63 21.2251 126.25 23.0837 126.25 25.0687C126.25 29.3531 123.025 31.9998 118.591 31.9998C114.156 31.9998 110.838 29.2588 110.838 25.0687H114.59C114.59 27.0849 116.42 28.4081 118.591 28.4081C120.761 28.4081 122.467 27.211 122.467 25.0687C122.467 22.9263 120.482 21.95 118.591 21.95C113.815 21.95 110.838 18.9883 110.838 14.1363C110.838 9.28464 114.311 6.26023 118.591 6.26023C119.8 6.26023 121.04 6.41739 122.095 7.1421L123.615 5.18896L126.405 7.3315Z" fill="#EF294B" />
      <path fillRule="evenodd" clipRule="evenodd" d="M131.887 14.1363C131.887 16.846 133.686 18.4525 135.888 18.4525C138.059 18.4525 139.857 16.8144 139.857 14.1363C139.857 11.4585 138.059 9.75724 135.888 9.75724C133.686 9.75724 131.887 11.4272 131.887 14.1363ZM143.703 7.3315L141.997 9.53673C143.175 10.8914 143.61 12.4351 143.61 14.1363C143.61 16.0579 142.897 18.7675 140.385 19.9335C142.928 21.2251 143.548 23.0837 143.548 25.0687C143.548 29.3531 140.322 31.9998 135.888 31.9998C131.453 31.9998 128.135 29.2588 128.135 25.0687H131.887C131.887 27.0849 133.717 28.4081 135.888 28.4081C138.059 28.4081 139.764 27.211 139.764 25.0687C139.764 22.9263 137.78 21.95 135.888 21.95C131.112 21.95 128.135 18.9883 128.135 14.1363C128.135 9.28464 131.609 6.26023 135.888 6.26023C137.098 6.26023 138.338 6.41739 139.392 7.1421L140.912 5.18896L143.703 7.3315Z" fill="#EF294B" />
      <path fillRule="evenodd" clipRule="evenodd" d="M153.088 29.4054H148.795L151.743 22.5211L145.432 6.91895H149.981L152.383 13.7713L153.889 18.2423L155.523 13.8678L158.405 6.91895H162.73L153.088 29.4054Z" fill="#EF294B" />
      <path fillRule="evenodd" clipRule="evenodd" d="M74.9462 18.767C72.3491 18.7539 70.5674 16.7478 70.5674 14.2958C70.5674 11.8436 72.1938 9.83682 74.9462 9.82484C77.6986 9.83682 79.3247 11.8436 79.3247 14.2958C79.3247 16.7478 77.5433 18.7539 74.9462 18.767ZM75.2045 6.0542H74.6876C69.9066 6.0542 66.7297 9.66418 66.7297 14.2959C66.7297 14.3509 66.732 14.4055 66.7331 14.4601H66.7297V32.0001H70.5355V21.5481C71.6556 22.1799 73.0052 22.5373 74.5617 22.5373H75.3304C80.3 22.5373 83.1622 18.896 83.1622 14.2959C83.1622 9.66418 79.9856 6.0542 75.2045 6.0542Z" fill="#EF294B" />
      <path d="M13.932 22V14.872C13.932 13.117 15.039 11.578 16.821 11.578C18.603 11.578 19.332 13.063 19.332 14.818V22H22.626V14.818C22.626 10.822 20.763 8.5 16.983 8.5C15.255 8.5 13.716 9.04 12.528 10.93C11.772 9.094 10.179 8.446 8.586 8.446C7.317 8.446 5.778 8.932 5.076 10.282L4.833 8.662H1.782V22H5.076V14.872C5.076 13.117 6.129 11.524 7.911 11.524C9.72 11.524 10.638 13.117 10.638 14.872V22H13.932ZM39.0274 16.519C39.5404 11.038 36.7594 8.284 32.3044 8.284C27.9844 8.284 25.2304 11.2 25.2304 15.25C25.2304 19.516 27.9574 22.351 32.5474 22.351C34.5724 22.351 36.8674 21.649 38.2714 20.191L36.1654 18.112C35.4094 18.895 33.8164 19.354 32.6014 19.354C30.2794 19.354 28.8484 18.166 28.6324 16.519H39.0274ZM28.6864 13.792C29.1724 12.064 30.6304 11.2 32.4124 11.2C34.3024 11.2 35.6524 12.064 35.8684 13.792H28.6864ZM41.4859 8.689V15.682C41.4859 19.813 43.8079 22.216 46.9939 22.216C48.8569 22.216 50.1259 21.568 51.5029 20.218L51.7189 22.027H54.6619V8.689H51.3949V15.493C51.3949 17.518 50.0179 19.219 47.9929 19.219C45.8869 19.219 44.7799 17.68 44.7799 15.655V8.689H41.4859ZM57.9101 20.299C57.9101 22.864 61.7981 22.864 61.7981 20.299C61.7981 17.734 57.9101 17.734 57.9101 20.299Z" fill="#574582" />
    </svg>
  );
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IcoBanco({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" x2="21" y1="22" y2="22" />
      <line x1="6" x2="6" y1="18" y2="11" />
      <line x1="10" x2="10" y1="18" y2="11" />
      <line x1="14" x2="14" y1="18" y2="11" />
      <line x1="18" x2="18" y1="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}

function IcoEscudo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function IcoCadeado({ color = "#8A909C" }: { color?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IcoFechar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function IcoLinkExterno() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function IcoRefresh({ spin }: { spin?: boolean }) {
  return (
    <svg
      width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={spin ? "animate-spin" : ""}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciais(nome: string | null): string {
  if (!nome) return "?";
  const p = nome.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[1][0]).toUpperCase()
    : nome.slice(0, 2).toUpperCase();
}

const CORES_AVATAR = ["#4078E6","#820AD1","#EC7000","#12A06B","#E8A020","#D74A45","#0891B2","#7C3AED"];

function corAvatar(nome: string | null): string {
  if (!nome) return CORES_AVATAR[0];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffff;
  return CORES_AVATAR[h % CORES_AVATAR.length];
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 2)  return "há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

type BadgeInfo = { bg: string; cor: string; ponto: string; texto: string };

function badgeItem(item: ItemResumo): BadgeInfo {
  switch (item.status) {
    case "UPDATED":
      return { bg: "#E2F4EC", cor: "#0E885A", ponto: "#12A06B", texto: `atualizado ${tempoRelativo(item.lastSyncedAt)}` };
    case "UPDATING":
      return { bg: "#EAF1FD", cor: "#2F63C9", ponto: "#4078E6", texto: "atualizando…" };
    case "LOGIN_ERROR":
      return { bg: "#FDE9ED", cor: "#C01530", ponto: "#EF294B", texto: "reconectar" };
    case "WAITING_USER_INPUT":
      return { bg: "#FCF1DF", cor: "#A8740F", ponto: "#E5982B", texto: "ação necessária" };
    case "OUTDATED":
      return { bg: "#FCF1DF", cor: "#A8740F", ponto: "#E5982B", texto: "precisa renovar" };
    default:
      return { bg: "#F0F2F6", cor: "#5B616E", ponto: "#8A909C", texto: "aguardando" };
  }
}

function precisaAcao(item: ItemResumo): boolean {
  return ["LOGIN_ERROR","WAITING_USER_INPUT","OUTDATED"].includes(item.status);
}

// ─── Modal de adição de banco (OAuth local + fallback manual) ────────────────

function ModalAdicionarBanco({
  onAdicionado,
  onFechar,
}: {
  onAdicionado: (item: ItemResumo) => void;
  onFechar: () => void;
}) {
  type Fase = "inicial" | "aguardando" | "manual";
  const [fase, setFase]         = useState<Fase>("inicial");
  const [itemIdManual, setItemIdManual] = useState("");
  const [carregando, setCarregando]     = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);

  async function handleConectarMeuPluggy() {
    setFase("aguardando");
    setErro(null);
    try {
      const item = await pluggyIniciarConexao();
      onAdicionado(item);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setFase("manual");
    }
  }

  async function handleAdicionarManual() {
    if (!itemIdManual.trim()) { setErro("Cole o item ID abaixo."); return; }
    setCarregando(true);
    setErro(null);
    try {
      const item = await pluggyRegistrarItem(itemIdManual.trim());
      onAdicionado(item);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  async function colar() {
    try {
      const txt = await navigator.clipboard.readText();
      setItemIdManual(txt);
    } catch { /* permissão negada */ }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div style={{ width: "500px", background: "#fff", borderRadius: "24px", padding: "28px 30px 26px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "11px", background: "#FDE9ED", color: "#EF294B", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <IcoBanco size={20} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "19px", letterSpacing: "-0.01em", color: "#0E1116" }}>Adicionar banco</div>
          </div>
          <button
            aria-label="Fechar"
            onClick={onFechar}
            style={{ width: "34px", height: "34px", borderRadius: "99px", border: "none", background: "#F0F2F6", color: "#5B616E", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <IcoFechar />
          </button>
        </div>

        {/* Fase: inicial */}
        {fase === "inicial" && (
          <>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#5B616E", lineHeight: 1.55, marginBottom: "20px" }}>
              Clique abaixo para abrir o MeuPluggy no seu browser. Faça login, conecte o banco e o Quibo detecta automaticamente.
            </p>
            <button
              onClick={handleConectarMeuPluggy}
              style={{ width: "100%", height: "52px", borderRadius: "99px", border: "none", background: "#EF294B", color: "#fff", fontWeight: 700, fontSize: "16px", cursor: "pointer", boxShadow: "0 6px 16px -4px rgba(239,41,75,.45)", marginBottom: "12px" }}
            >
              Abrir MeuPluggy e conectar
            </button>
            <button
              onClick={() => setFase("manual")}
              style={{ width: "100%", height: "40px", borderRadius: "99px", border: "1px solid #D4D8E0", background: "#fff", color: "#5B616E", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
            >
              Tenho o item ID (avançado)
            </button>
          </>
        )}

        {/* Fase: aguardando callback */}
        {fase === "aguardando" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" style={{ margin: "0 auto 20px" }} />
            <p style={{ fontWeight: 600, fontSize: "15px", color: "#0E1116", marginBottom: "8px" }}>
              Aguardando conexão no MeuPluggy…
            </p>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#5B616E", lineHeight: 1.5 }}>
              O browser abriu com o MeuPluggy. Faça login, escolha o banco e autorize a leitura. O Quibo detecta quando concluir (até 5 min).
            </p>
            <button
              onClick={() => setFase("manual")}
              style={{ marginTop: "20px", height: "36px", padding: "0 20px", borderRadius: "99px", border: "1px solid #D4D8E0", background: "#fff", color: "#5B616E", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              Adicionar manualmente
            </button>
          </div>
        )}

        {/* Fase: manual */}
        {fase === "manual" && (
          <>
            <p style={{ fontSize: "13.5px", fontWeight: 500, color: "#5B616E", lineHeight: 1.5, marginBottom: "16px" }}>
              Após conectar no MeuPluggy, copie o <strong>item ID</strong> em{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); open("https://dashboard.pluggy.ai"); }} style={{ color: "#4078E6", fontWeight: 600, textDecoration: "none" }}>
                dashboard.pluggy.ai
              </a>{" "}
              → Itens, e cole abaixo.
            </p>

            {erro && (
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#D74A45", background: "#FDE9ED", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px" }}>{erro}</p>
            )}

            <label style={{ display: "block", marginBottom: "16px" }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: "13px", color: "#5B616E", marginBottom: "8px" }}>item ID</span>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", height: "50px", padding: "0 8px 0 16px", background: "#fff", borderRadius: "12px", border: "1px solid #E3E6EC" }}>
                <input
                  value={itemIdManual}
                  onChange={(e) => setItemIdManual(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", font: "600 13px 'Hanken Grotesk', monospace", color: "#0E1116" }}
                />
                <button
                  type="button"
                  onClick={colar}
                  style={{ height: "36px", padding: "0 14px", borderRadius: "99px", border: "none", background: "#F0F2F6", color: "#0E1116", fontWeight: 600, fontSize: "13px", cursor: "pointer", flex: "none" }}
                >
                  Colar
                </button>
              </span>
            </label>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setFase("inicial")}
                style={{ flex: "none", height: "48px", padding: "0 18px", borderRadius: "99px", border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
              >
                Voltar
              </button>
              <button
                onClick={handleAdicionarManual}
                disabled={carregando}
                style={{ flex: 1, height: "48px", borderRadius: "99px", border: "none", background: "#4078E6", color: "#fff", fontWeight: 600, fontSize: "15px", cursor: "pointer", opacity: carregando ? 0.6 : 1 }}
              >
                {carregando ? "Validando…" : "Adicionar banco"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal de configuração inicial ───────────────────────────────────────────

function ModalConectar({
  onSalvo,
  onFechar,
}: {
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [clientId, setClientId]         = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [salvando, setSalvando]         = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);

  async function colarSecret() {
    try {
      const texto = await navigator.clipboard.readText();
      setClientSecret(texto);
    } catch {
      /* permissão negada — usuário digita manualmente */
    }
  }

  async function handleSalvar() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setErro("Preencha as duas chaves.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await pluggySalvarCredenciais(clientId.trim(), clientSecret.trim());
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div style={{ width: "500px", background: "#fff", borderRadius: "24px", padding: "28px 30px 26px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "11px", background: "#FDE9ED", color: "#EF294B", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <IcoBanco size={20} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "19px", letterSpacing: "-0.01em", color: "#0E1116" }}>Conectar a Pluggy</div>
          </div>
          <button
            aria-label="Fechar"
            onClick={onFechar}
            style={{ width: "34px", height: "34px", borderRadius: "99px", border: "none", background: "#F0F2F6", color: "#5B616E", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <IcoFechar />
          </button>
        </div>

        {/* Passos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          {[
            <span>Crie sua conta no{" "}<a href="#" onClick={(e) => { e.preventDefault(); open("https://meu.pluggy.ai"); }} style={{ color: "#4078E6", fontWeight: 600, textDecoration: "none" }}>meu.pluggy.ai</a>{" "}e conecte seus bancos por lá.</span>,
            <span>No{" "}<a href="#" onClick={(e) => { e.preventDefault(); open("https://dashboard.pluggy.ai"); }} style={{ color: "#4078E6", fontWeight: 600, textDecoration: "none" }}>painel da Pluggy</a>, crie um app de desenvolvedor e copie suas chaves.</span>,
            <span>Cole as chaves aqui — elas ficam só neste computador.</span>,
          ].map((texto, i) => (
            <div key={i} style={{ display: "flex", gap: "12px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "99px", background: "#EAF1FD", color: "#2F63C9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flex: "none" }}>
                {i + 1}
              </div>
              <div style={{ fontWeight: 500, fontSize: "13.5px", color: "#3A3F4A", lineHeight: 1.5 }}>{texto}</div>
            </div>
          ))}
        </div>

        {/* client_id */}
        <label style={{ display: "block", marginBottom: "12px" }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: "13px", color: "#5B616E", marginBottom: "8px" }}>client_id</span>
          <span style={{ display: "flex", alignItems: "center", height: "50px", padding: "0 16px", background: "#fff", borderRadius: "12px", border: "1px solid #E3E6EC" }}>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="cole aqui…"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", font: "600 14px 'Hanken Grotesk', sans-serif", color: "#0E1116" }}
            />
          </span>
        </label>

        {/* client_secret */}
        <label style={{ display: "block", marginBottom: "18px" }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: "13px", color: "#5B616E", marginBottom: "8px" }}>
            client_secret <span style={{ fontWeight: 500, color: "#B5BCC9" }}>· secreta</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px", height: "50px", padding: "0 8px 0 16px", background: "#fff", borderRadius: "12px", border: "1px solid #4078E6", boxShadow: "0 0 0 3px #EAF1FD" }}>
            <IcoCadeado />
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="cole aqui…"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", font: "600 14px 'Hanken Grotesk', sans-serif", color: "#0E1116", letterSpacing: "1px" }}
            />
            <button
              type="button"
              onClick={colarSecret}
              style={{ height: "36px", padding: "0 14px", borderRadius: "99px", border: "none", background: "#F0F2F6", color: "#0E1116", fontWeight: 600, fontSize: "13px", cursor: "pointer", flex: "none" }}
            >
              Colar
            </button>
          </span>
        </label>

        {/* Aviso de segurança */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", background: "#F4F5F7", borderRadius: "12px", padding: "12px 14px", marginBottom: "18px" }}>
          <IcoCadeado />
          <span style={{ fontWeight: 500, fontSize: "12.5px", color: "#5B616E", lineHeight: 1.45 }}>
            Guardamos suas chaves criptografadas neste computador. Elas nunca aparecem na tela depois e nunca saem daqui.
          </span>
        </div>

        {erro && (
          <p style={{ fontSize: "13px", fontWeight: 500, color: "#D74A45", marginBottom: "14px", paddingLeft: "2px" }}>{erro}</p>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onFechar}
            style={{ flex: "none", height: "48px", padding: "0 22px", borderRadius: "99px", border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            style={{ flex: 1, height: "48px", borderRadius: "99px", border: "none", background: "#4078E6", color: "#fff", fontWeight: 600, fontSize: "15px", cursor: "pointer", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)", opacity: salvando ? 0.6 : 1 }}
          >
            {salvando ? "Validando…" : "Validar e conectar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de gerenciamento (desconexão) ──────────────────────────────────────

function ModalGerenciar({
  onDesconectado,
  onFechar,
}: {
  onDesconectado: () => void;
  onFechar: () => void;
}) {
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro]           = useState<string | null>(null);

  async function handleDesconectar() {
    setRemovendo(true);
    setErro(null);
    try {
      await pluggyRemoverCredenciais();
      onDesconectado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div style={{ width: "440px", background: "#fff", borderRadius: "24px", padding: "28px 30px 26px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{ fontWeight: 700, fontSize: "19px", letterSpacing: "-0.01em", color: "#0E1116" }}>Gerenciar integração</div>
          <button
            aria-label="Fechar"
            onClick={onFechar}
            style={{ width: "34px", height: "34px", borderRadius: "99px", border: "none", background: "#F0F2F6", color: "#5B616E", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <IcoFechar />
          </button>
        </div>

        <p style={{ fontWeight: 500, fontSize: "14px", color: "#5B616E", lineHeight: 1.55, marginBottom: "22px" }}>
          Desconectar remove as chaves de API deste computador. Os lançamentos já importados permanecem no Quibo.
          Para revogar o acesso bancário, vá ao <a href="#" onClick={(e) => { e.preventDefault(); open("https://meu.pluggy.ai"); }} style={{ color: "#4078E6", fontWeight: 600, textDecoration: "none" }}>MeuPluggy</a>.
        </p>

        {erro && (
          <p style={{ fontSize: "13px", fontWeight: 500, color: "#D74A45", marginBottom: "14px" }}>{erro}</p>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onFechar}
            style={{ flex: "none", height: "48px", padding: "0 22px", borderRadius: "99px", border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleDesconectar}
            disabled={removendo}
            style={{ flex: 1, height: "48px", borderRadius: "99px", border: "none", background: "#D74A45", color: "#fff", fontWeight: 600, fontSize: "15px", cursor: "pointer", opacity: removendo ? 0.6 : 1 }}
          >
            {removendo ? "Removendo…" : "Desconectar Pluggy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de banco ────────────────────────────────────────────────────────────

function CardBanco({
  item,
  onAtualizar,
  sincronizando,
}: {
  item: ItemResumo;
  onAtualizar: () => void;
  sincronizando: boolean;
}) {
  const badge = badgeItem(item);
  const acao  = precisaAcao(item);

  const subtitulo = (): string | null => {
    if (item.status === "LOGIN_ERROR") return "as credenciais expiraram — reconecte no MeuPluggy";
    if (item.status === "OUTDATED")    return "a conexão venceu — reative no MeuPluggy";
    return null;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px" }}>
      <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: corAvatar(item.connectorName), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "15px", flex: "none" }}>
        {iniciais(item.connectorName)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: 600, fontSize: "15px", color: "#0E1116" }}>
            {item.connectorName ?? "Banco desconhecido"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "22px", padding: "0 9px", borderRadius: "99px", background: badge.bg, color: badge.cor, fontWeight: 600, fontSize: "11.5px" }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "99px", background: badge.ponto }} />
            {badge.texto}
          </span>
        </div>
        {subtitulo() && (
          <div style={{ fontWeight: 500, fontSize: "13px", color: "#5B616E", marginTop: "3px" }}>
            {subtitulo()}
          </div>
        )}
      </div>

      {acao ? (
        <button
          onClick={() => open("https://meu.pluggy.ai")}
          aria-label="Abrir MeuPluggy"
          title="Abrir MeuPluggy"
          style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", background: badge.bg, color: badge.cor, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}
        >
          <IcoLinkExterno />
        </button>
      ) : (
        <button
          onClick={onAtualizar}
          disabled={sincronizando}
          aria-label={sincronizando ? "Atualizando…" : "Atualizar"}
          title={sincronizando ? "Atualizando…" : "Atualizar"}
          style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", opacity: sincronizando ? 0.6 : 1 }}
        >
          <IcoRefresh spin={sincronizando} />
        </button>
      )}
    </div>
  );
}

// ─── View: não configurado ────────────────────────────────────────────────────

function ViewNaoConfigurado({ onConectar }: { onConectar: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "18px", background: "#fff", border: "1px solid #E3E6EC", borderRadius: "16px", padding: "22px 24px", marginTop: "18px" }}>
      <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "#FDE9ED", color: "#EF294B", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <IcoBanco size={26} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <PluggyLogo />
        <div style={{ fontWeight: 500, fontSize: "13px", color: "#5B616E", marginTop: "5px" }}>
          conecte seus bancos uma vez e o Quibo lê sozinho, todo dia
        </div>
      </div>
      <button
        onClick={onConectar}
        style={{ height: "42px", padding: "0 18px", borderRadius: "99px", border: "none", background: "#4078E6", color: "#fff", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
      >
        Conectar
      </button>
    </div>
  );
}

// ─── View: conectado ──────────────────────────────────────────────────────────

function ViewConectado({
  items,
  onAtualizar,
  onAtualizarTudo,
  onAdicionarBanco,
  onGerenciar,
  itemSincronizando,
  sincronizandoTodos,
  totalImportadasMes,
  totalFaturas,
  ultimoSync,
}: {
  items: ItemResumo[];
  onAtualizar: (id: string) => void;
  onAtualizarTudo: () => void;
  onAdicionarBanco: () => void;
  onGerenciar: () => void;
  itemSincronizando: string | null;
  sincronizandoTodos: boolean;
  totalImportadasMes: number;
  totalFaturas: number;
  ultimoSync: string | null;
}) {
  const totalContas = items.length;
  const ultimoTexto = ultimoSync
    ? `última sincronização ${tempoRelativo(ultimoSync)}`
    : "nunca sincronizado";

  return (
    <>
      {/* Status card Pluggy */}
      <div style={{ display: "flex", alignItems: "center", gap: "18px", background: "#fff", border: "1px solid #E3E6EC", borderRadius: "16px", padding: "20px 22px", marginTop: "18px" }}>
        <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "#FDE9ED", color: "#EF294B", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <IcoBanco size={26} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <PluggyLogo />
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", height: "24px", padding: "0 10px", borderRadius: "99px", background: "#E2F4EC", color: "#0E885A", fontWeight: 600, fontSize: "12px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "99px", background: "#12A06B" }} />
              conectado
            </span>
          </div>
          <div style={{ fontWeight: 500, fontSize: "13px", color: "#5B616E", marginTop: "5px" }}>
            suas credenciais ficam só neste computador · atualiza sozinho todo dia
          </div>
        </div>
        <button
          onClick={onGerenciar}
          style={{ height: "40px", padding: "0 16px", borderRadius: "99px", border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
        >
          Gerenciar
        </button>
      </div>

      {/* Aviso de privacidade */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", background: "#EAF1FD", border: "1px solid #D5E4FB", borderRadius: "14px", padding: "14px 18px", marginTop: "12px" }}>
        <div style={{ color: "#2F63C9", flex: "none", marginTop: "1px" }}>
          <IcoEscudo />
        </div>
        <div style={{ fontWeight: 500, fontSize: "13.5px", color: "#1F3D7A", lineHeight: 1.5 }}>
          Você conecta seus bancos no <strong style={{ fontWeight: 700 }}>MeuPluggy</strong> — um app gratuito da Pluggy, onde você controla e revoga o acesso quando quiser. O Quibo só lê. Nada vai pra fora deste computador.
        </div>
      </div>

      {/* Cabeçalho da lista */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 4px 12px" }}>
        <div style={{ fontWeight: 600, fontSize: "16px", letterSpacing: "-0.01em", color: "#0E1116" }}>Bancos conectados</div>
        <div style={{ fontWeight: 500, fontSize: "13px", color: "#8A909C" }}>
          {totalContas} {totalContas === 1 ? "banco" : "bancos"} · atualiza todo dia
        </div>
      </div>

      {/* Lista de bancos */}
      <div style={{ background: "#fff", border: "1px solid #E3E6EC", borderRadius: "16px", overflow: "hidden" }}>
        {items.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", gap: "16px" }}>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#5B616E", textAlign: "center", lineHeight: 1.55, margin: 0 }}>
              Nenhum banco conectado ainda. Clique abaixo para abrir o MeuPluggy e adicionar sua primeira conta.
            </p>
            <button
              onClick={onAdicionarBanco}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 20px", borderRadius: "99px", border: "none", background: "#4078E6", color: "#fff", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
            >
              <IcoBanco size={17} />
              Adicionar banco
            </button>
          </div>
        ) : (
          <>
            {items.map((item, i) => (
              <div key={item.pluggyItemId}>
                <CardBanco
                  item={item}
                  sincronizando={itemSincronizando === item.pluggyItemId || sincronizandoTodos}
                  onAtualizar={() => onAtualizar(item.pluggyItemId)}
                />
                {i < items.length - 1 && (
                  <div style={{ height: "1px", background: "#EEF0F4", margin: "0 20px" }} />
                )}
              </div>
            ))}
            {/* Adicionar banco adicional */}
            <div style={{ borderTop: "1px solid #EEF0F4", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 500, fontSize: "13px", color: "#8A909C" }}>
                Quer adicionar mais um banco?
              </span>
              <button
                onClick={onAdicionarBanco}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", borderRadius: "99px", border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
              >
                <IcoBanco size={14} />
                Adicionar banco
              </button>
            </div>
          </>
        )}
      </div>

      {/* Resumo + Atualizar tudo */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #E3E6EC", borderRadius: "16px", padding: "18px 22px", marginTop: "14px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "15px", color: "#0E1116" }}>Importadas este mês</div>
          <div style={{ fontWeight: 500, fontSize: "13px", color: "#5B616E", marginTop: "3px", fontFeatureSettings: "'tnum' 1,'lnum' 1" }}>
            {totalImportadasMes} transações{totalFaturas > 0 ? ` · ${totalFaturas} faturas` : ""} · {ultimoTexto}
          </div>
        </div>
        <button
          onClick={onAtualizarTudo}
          disabled={sincronizandoTodos}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 20px", borderRadius: "99px", border: "none", background: "#4078E6", color: "#fff", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)", opacity: sincronizandoTodos ? 0.6 : 1 }}
        >
          <IcoRefresh spin={sincronizandoTodos} />
          {sincronizandoTodos ? "Atualizando…" : "Atualizar tudo"}
        </button>
      </div>

      <div style={{ textAlign: "center", fontWeight: 500, fontSize: "12.5px", color: "#A6ABB5", marginTop: "16px" }}>
        Quer parar? Desligar a leitura e apagar o que veio é um clique. Revogar o acesso é no MeuPluggy.
      </div>
    </>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

type EstadoTela = "carregando" | "nao-configurado" | "configurado";

export function PluggyIntegracaoScreen() {
  const [estadoTela, setEstadoTela]                   = useState<EstadoTela>("carregando");
  const [items, setItems]                             = useState<ItemResumo[]>([]);
  const [modalConectarAberto, setModalConectarAberto]   = useState(false);
  const [modalGerenciarAberto, setModalGerenciarAberto] = useState(false);
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [itemSincronizando, setItemSincronizando]       = useState<string | null>(null);
  const [sincronizandoTodos, setSincronizandoTodos]     = useState(false);
  const [resultados, setResultados]                   = useState<ResultadoSync[]>([]);

  const carregarEstado = useCallback(async () => {
    try {
      const status = await pluggyStatusCredenciais();
      if (!status.configurado) { setEstadoTela("nao-configurado"); return; }
      const lista = await pluggyListarItems();
      setItems(lista);
      setEstadoTela("configurado");
    } catch {
      setEstadoTela("nao-configurado");
    }
  }, []);

  useEffect(() => { carregarEstado(); }, [carregarEstado]);

  async function handleCredenciaisSalvas() {
    setModalConectarAberto(false);
    try {
      const descobertos = await pluggyDescobrirItems();
      setItems(descobertos);
      setEstadoTela("configurado");
    } catch {
      await carregarEstado();
    }
  }

  function handleBancoAdicionado(item: ItemResumo) {
    setModalAdicionarAberto(false);
    setItems((prev) => {
      const jaExiste = prev.some((i) => i.pluggyItemId === item.pluggyItemId);
      return jaExiste ? prev : [...prev, item];
    });
  }

  async function handleAtualizar(pluggyItemId: string) {
    setItemSincronizando(pluggyItemId);
    try {
      const res = await pluggySincronizarItem(pluggyItemId, true);
      setItems(await pluggyListarItems());
      const total = res.entriesImportados + res.entriesAtualizados;
      if (res.status === "SUCCESS") {
        toast.sucesso(
          total > 0
            ? `${total} transaç${total === 1 ? "ão importada" : "ões importadas"}`
            : "Banco atualizado",
          { descricao: res.connectorName ?? undefined }
        );
      } else if (res.status === "LOGIN_ERROR") {
        toast.aviso("Reconecte o banco", {
          descricao: `${res.connectorName ?? "Banco"} precisa de nova autorização no MeuPluggy`,
        });
      } else if (res.status === "ERROR") {
        toast.erro("Falha ao atualizar", {
          descricao: res.erro ?? res.connectorName ?? undefined,
        });
      }
    } catch (e) {
      toast.erro("Falha ao atualizar banco", {
        descricao: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setItemSincronizando(null);
    }
  }

  async function handleAtualizarTudo() {
    setSincronizandoTodos(true);
    try {
      const res = await pluggySincronizarTodos(true);
      setResultados(res);
      setItems(await pluggyListarItems());

      const totalImportadas = res.reduce(
        (s, r) => s + r.entriesImportados + r.entriesAtualizados,
        0
      );
      const comErro = res.filter((r) =>
        ["ERROR", "LOGIN_ERROR"].includes(r.status)
      );

      if (comErro.length === 0) {
        toast.sucesso(
          totalImportadas > 0
            ? `${totalImportadas} transaç${totalImportadas === 1 ? "ão importada" : "ões importadas"}`
            : "Todos os bancos atualizados",
          { descricao: `${res.length} banco${res.length === 1 ? "" : "s"} sincronizado${res.length === 1 ? "" : "s"}` }
        );
      } else {
        toast.aviso(
          `${res.length - comErro.length} de ${res.length} banco${res.length === 1 ? "" : "s"} atualizado${res.length - comErro.length === 1 ? "" : "s"}`,
          {
            descricao: comErro
              .map((r) => r.connectorName ?? r.pluggyItemId)
              .join(", ") + " com problema",
          }
        );
      }
    } catch (e) {
      toast.erro("Falha ao sincronizar", {
        descricao: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSincronizandoTodos(false);
    }
  }

  async function handleDesconectado() {
    setModalGerenciarAberto(false);
    setItems([]);
    setResultados([]);
    setEstadoTela("nao-configurado");
  }

  const totalImportadasMes = resultados.reduce(
    (s, r) => s + r.entriesImportados + r.entriesAtualizados, 0
  );

  const totalFaturas = resultados.reduce(
    (s, r) => s + (r.faturasSincronizadas ?? 0), 0
  );

  const ultimoSync = items.reduce<string | null>((mais, item) => {
    if (!item.lastSyncedAt) return mais;
    if (!mais) return item.lastSyncedAt;
    return item.lastSyncedAt > mais ? item.lastSyncedAt : mais;
  }, null);

  return (
    <div className="animate-fade-in" style={{ maxWidth: "720px", margin: "0 auto", width: "100%", paddingTop: "6px" }}>

      {/* Cabeçalho */}
      <div style={{ padding: "2px 2px 0" }}>
        <div style={{ fontWeight: 700, fontSize: "24px", letterSpacing: "-0.02em", color: "#0E1116" }}>
          Seus bancos, sem digitar
        </div>
        <div style={{ fontWeight: 500, fontSize: "15px", color: "#5B616E", marginTop: "6px" }}>
          {estadoTela === "configurado"
            ? "O Quibo lê seus lançamentos reais pelo MeuPluggy — você só confirma. A gente nunca move seu dinheiro."
            : "O Quibo lê seus lançamentos reais pelo MeuPluggy — você só confirma."}
        </div>
      </div>

      {/* Corpo */}
      {estadoTela === "carregando" && (
        <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
          <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      )}

      {estadoTela === "nao-configurado" && (
        <ViewNaoConfigurado onConectar={() => setModalConectarAberto(true)} />
      )}

      {estadoTela === "configurado" && (
        <ViewConectado
          items={items}
          onAtualizar={handleAtualizar}
          onAtualizarTudo={handleAtualizarTudo}
          onAdicionarBanco={() => setModalAdicionarAberto(true)}
          onGerenciar={() => setModalGerenciarAberto(true)}
          itemSincronizando={itemSincronizando}
          sincronizandoTodos={sincronizandoTodos}
          totalImportadasMes={totalImportadasMes}
          totalFaturas={totalFaturas}
          ultimoSync={ultimoSync}
        />
      )}

      {/* Modais */}
      {modalConectarAberto && (
        <ModalConectar
          onSalvo={handleCredenciaisSalvas}
          onFechar={() => setModalConectarAberto(false)}
        />
      )}

      {modalGerenciarAberto && (
        <ModalGerenciar
          onDesconectado={handleDesconectado}
          onFechar={() => setModalGerenciarAberto(false)}
        />
      )}

      {modalAdicionarAberto && (
        <ModalAdicionarBanco
          onAdicionado={handleBancoAdicionado}
          onFechar={() => setModalAdicionarAberto(false)}
        />
      )}
    </div>
  );
}
