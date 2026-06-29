import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingStore, type Foco } from "../../store/onboarding";
import { usePerfilStore } from "@/app/perfil-store";
import { StepDots } from "./step-dots";

interface CardOpcaoProps {
  selecionado: boolean;
  onClick: () => void;
  iconeBg: string;
  iconeColor: string;
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}

function CardOpcao({
  selecionado,
  onClick,
  iconeBg,
  iconeColor,
  icone,
  titulo,
  descricao,
}: CardOpcaoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-[14px] bg-surface rounded-2xl p-[15px_18px] cursor-pointer transition-all text-left"
      style={{
        border: selecionado ? "1px solid #4078E6" : "1px solid #E3E6EC",
        boxShadow: selecionado ? "0 0 0 3px #EAF1FD" : "none",
      }}
    >
      <div
        className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconeBg, color: iconeColor }}
      >
        {icone}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] text-ink">{titulo}</p>
        <p className="font-medium text-[13px] text-[#5B616E] mt-0.5">
          {descricao}
        </p>
      </div>
      <span
        className="w-[22px] h-[22px] rounded-md shrink-0 flex items-center justify-center transition-all"
        style={{
          background: selecionado ? "#4078E6" : "transparent",
          border: selecionado ? "none" : "2px solid #D4D8E0",
        }}
      >
        {selecionado && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 5 5L20 7" />
          </svg>
        )}
      </span>
    </button>
  );
}

const OPCOES: Array<{
  valor: Foco;
  titulo: string;
  descricao: string;
  iconeBg: string;
  iconeColor: string;
  icone: React.ReactNode;
}> = [
  {
    valor: "reserva",
    titulo: "Montar minha reserva",
    descricao: "um colchão pra dormir tranquilo",
    iconeBg: "#E2F4EC",
    iconeColor: "#0E885A",
    icone: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      </svg>
    ),
  },
  {
    valor: "dividas",
    titulo: "Sair das dívidas",
    descricao: "quitar o que pesa todo mês",
    iconeBg: "#FBE9E7",
    iconeColor: "#C0413B",
    icone: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
        <polyline points="16 17 22 17 22 11" />
      </svg>
    ),
  },
  {
    valor: "objetivo",
    titulo: "Juntar pra um objetivo",
    descricao: "uma viagem, um curso, uma troca",
    iconeBg: "#EAF1FD",
    iconeColor: "#2F63C9",
    icone: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
];

export function OnboardingMetaScreen() {
  const navigate = useNavigate();
  const { focos, setFocos, focoFrase, setFocoFrase } = useOnboardingStore();
  const { atualizarFocos, atualizarFocoFrase } = usePerfilStore();
  const [frase, setFrase] = useState(focoFrase);
  const [campoFocado, setCampoFocado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const temSelecao = focos.length > 0 || frase.trim().length > 0;

  function toggleFoco(valor: Foco) {
    if (focos.includes(valor)) {
      setFocos(focos.filter((f) => f !== valor));
    } else {
      setFocos([...focos, valor]);
    }
  }

  async function avancar() {
    const fraseTrimada = frase.trim();
    setFocoFrase(fraseTrimada);
    setSalvando(true);
    try {
      await atualizarFocos(focos);
      await atualizarFocoFrase(fraseTrimada);
    } catch (e) {
      console.error("[quibo] Erro ao salvar foco:", e);
    } finally {
      setSalvando(false);
    }
    navigate("/onboarding/tudo-pronto");
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[430px] flex flex-col items-center text-center">
        <StepDots total={4} current={4} concluidos={3} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 4 de 4
        </p>

        <h1 className="font-bold text-[30px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Qual seu foco agora?
        </h1>

        <p className="font-medium text-[15px] text-[#5B616E] mt-[10px] leading-relaxed">
          Pode marcar mais de um — o Quibo vai destacar o que mais importa pra você.
        </p>

        <div className="w-full mt-[22px] flex flex-col gap-[10px]">
          {OPCOES.map((op) => (
            <CardOpcao
              key={op.valor}
              selecionado={focos.includes(op.valor)}
              onClick={() => toggleFoco(op.valor)}
              iconeBg={op.iconeBg}
              iconeColor={op.iconeColor}
              icone={op.icone}
              titulo={op.titulo}
              descricao={op.descricao}
            />
          ))}

          {/* 4ª opção: campo aberto */}
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="w-full flex items-center gap-[14px] bg-surface rounded-2xl p-[15px_18px] cursor-text transition-all text-left"
            style={{
              border:
                campoFocado || frase.trim()
                  ? "1px solid #4078E6"
                  : "1px solid #E3E6EC",
              boxShadow:
                campoFocado || frase.trim() ? "0 0 0 3px #EAF1FD" : "none",
            }}
          >
            <div className="w-[42px] h-[42px] rounded-xl bg-[#F5F0FF] text-[#7C3AED] flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 19.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] text-ink">Outro objetivo</p>
              <input
                ref={inputRef}
                value={frase}
                onChange={(e) => setFrase(e.target.value)}
                onFocus={() => setCampoFocado(true)}
                onBlur={() => setCampoFocado(false)}
                placeholder="Ex: quero viajar pro Chile em dezembro"
                className="w-full border-none outline-none bg-transparent font-medium text-[13px] text-ink placeholder:text-ink-muted mt-0.5 cursor-text"
              />
            </div>
            {frase.trim() && (
              <span className="w-[22px] h-[22px] rounded-md shrink-0 flex items-center justify-center bg-brand">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              </span>
            )}
          </button>
        </div>

        <button
          onClick={avancar}
          disabled={!temSelecao || salvando}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-[22px] cursor-pointer transition-colors hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ boxShadow: temSelecao ? "0 6px 16px -4px rgba(64,120,230,.45)" : "none" }}
        >
          {salvando ? "Salvando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
