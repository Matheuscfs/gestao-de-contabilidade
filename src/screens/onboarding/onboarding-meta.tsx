import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingStore, type Foco } from "./onboarding-store";
import { StepDots } from "./step-dots";

interface OpcaoMetaProps {
  selecionado: boolean;
  onClick: () => void;
  titulo: string;
  descricao: string;
  iconeBg: string;
  iconeColor: string;
  icone: React.ReactNode;
}

function OpcaoMeta({ selecionado, onClick, titulo, descricao, iconeBg, iconeColor, icone }: OpcaoMetaProps) {
  return (
    <div
      role="radio"
      aria-checked={selecionado}
      onClick={onClick}
      className="flex items-center gap-[14px] bg-surface rounded-2xl p-[15px_18px] cursor-pointer transition-all"
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
      <div className="flex-1 min-w-0 text-left">
        <p className="font-semibold text-[15px] text-ink">{titulo}</p>
        <p className="font-medium text-[13px] text-[#5B616E] mt-0.5">{descricao}</p>
      </div>
      {selecionado ? (
        <span className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5L20 7" />
          </svg>
        </span>
      ) : (
        <span className="w-6 h-6 rounded-full border-2 border-[#D4D8E0] shrink-0" />
      )}
    </div>
  );
}

export function OnboardingMetaScreen() {
  const navigate = useNavigate();
  const { foco, setFoco, focoFrase, setFocoFrase } = useOnboardingStore();
  const [frase, setFrase] = useState(focoFrase);

  function avancar() {
    setFocoFrase(frase);
    navigate("/onboarding/tom-da-ia");
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[430px] flex flex-col items-center text-center">
        <StepDots total={5} current={4} concluidos={3} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 4 de 5
        </p>

        <h1 className="font-bold text-[30px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Qual seu foco agora?
        </h1>

        <p className="font-medium text-[15px] text-[#5B616E] mt-[10px] leading-relaxed">
          Escolhe o que mais pesa pra você. É isso que o Quibo vai destacar no seu mês.
        </p>

        <div className="w-full mt-[22px] flex flex-col gap-[10px]">
          <OpcaoMeta
            selecionado={foco === "reserva"}
            onClick={() => setFoco(foco === "reserva" ? null : "reserva")}
            titulo="Montar minha reserva"
            descricao="um colchão pra dormir tranquila"
            iconeBg="#E2F4EC"
            iconeColor="#0E885A"
            icone={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              </svg>
            }
          />
          <OpcaoMeta
            selecionado={foco === "dividas"}
            onClick={() => setFoco(foco === "dividas" ? null : "dividas")}
            titulo="Sair das dívidas"
            descricao="quitar o que pesa todo mês"
            iconeBg="#FBE9E7"
            iconeColor="#C0413B"
            icone={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                <polyline points="16 17 22 17 22 11" />
              </svg>
            }
          />
          <OpcaoMeta
            selecionado={foco === "objetivo"}
            onClick={() => setFoco(foco === "objetivo" ? null : "objetivo")}
            titulo="Juntar pra um objetivo"
            descricao="uma viagem, um curso, uma troca"
            iconeBg="#EAF1FD"
            iconeColor="#2F63C9"
            icone={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            }
          />
          <OpcaoMeta
            selecionado={foco === "consciencia"}
            onClick={() => setFoco(foco === "consciencia" ? null : "consciencia")}
            titulo="Gastar com consciência"
            descricao="sem culpa, sem se perder"
            iconeBg="#FCF1DF"
            iconeColor="#B9791C"
            icone={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            }
          />
        </div>

        <div className="w-full mt-[14px] text-left">
          <span className="block font-semibold text-[13px] text-[#5B616E] mb-2">
            Conta em uma frase{" "}
            <span className="font-medium text-ink-muted">(opcional)</span>
          </span>
          <span
            className="flex items-center h-[50px] px-4 bg-surface rounded-xl"
            style={{ border: "1px solid #D4D8E0" }}
          >
            <input
              value={frase}
              onChange={(e) => setFrase(e.target.value)}
              placeholder="Ex: quero viajar pro Chile em dezembro"
              className="flex-1 min-w-0 border-none outline-none bg-transparent font-medium text-sm text-ink font-sans"
            />
          </span>
        </div>

        <button
          onClick={avancar}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-[22px] cursor-pointer transition-colors hover:bg-brand-600"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
