import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingStore, type TomIA } from "./onboarding-store";
import { StepDots } from "./step-dots";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between px-[18px] py-[14px] text-left">
      <span className="font-semibold text-sm text-ink pr-3">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 w-[46px] h-[27px] rounded-full border-none cursor-pointer transition-colors"
        style={{ background: checked ? "#4078E6" : "#D4D8E0", padding: 0 }}
      >
        <span
          className="absolute top-[3px] w-[21px] h-[21px] rounded-full bg-surface transition-[left] duration-200"
          style={{
            left: checked ? "22px" : "3px",
            boxShadow: "0 1px 3px rgba(14,17,22,.25)",
          }}
        />
      </button>
    </div>
  );
}

const toms: { id: TomIA; label: string }[] = [
  { id: "direto", label: "Direto, sem rodeios" },
  { id: "gentil", label: "Gentil" },
  { id: "didatico", label: "Didático" },
];

export function OnboardingTomDaIAScreen() {
  const navigate = useNavigate();
  const {
    tomIA, setTomIA,
    puxarOrelha, setPuxarOrelha,
    comemorarVitorias, setComemorarVitorias,
    contextoIA, setContextoIA,
  } = useOnboardingStore();

  const [contexto, setContexto] = useState(contextoIA);

  function concluir() {
    setContextoIA(contexto);
    navigate("/onboarding/tudo-pronto");
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[440px] flex flex-col items-center text-center">
        <StepDots total={5} current={5} concluidos={4} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 5 de 5
        </p>

        <h1 className="font-bold text-[30px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Como prefere que a gente fale?
        </h1>

        <p className="font-medium text-[15px] text-[#5B616E] mt-[10px] leading-relaxed">
          Isso vira o fundamento de como a IA te trata.
          <br />
          Dá pra mudar quando quiser.
        </p>

        <div className="w-full flex gap-2 mt-[22px]">
          {toms.map(({ id, label }) => {
            const ativo = tomIA === id;
            return (
              <button
                key={id}
                onClick={() => setTomIA(id)}
                className="flex-1 h-[42px] rounded-full font-semibold text-[13.5px] cursor-pointer transition-all whitespace-nowrap px-2"
                style={{
                  border: ativo ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                  background: ativo ? "#EAF1FD" : "#fff",
                  color: ativo ? "#2F63C9" : "#5B616E",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          className="w-full bg-surface rounded-2xl overflow-hidden mt-[14px]"
          style={{ border: "1px solid #E3E6EC" }}
        >
          <ToggleSwitch
            checked={puxarOrelha}
            onChange={setPuxarOrelha}
            label="Pode puxar minha orelha quando eu furar o orçamento"
          />
          <div className="h-px bg-[#EEF0F4] mx-[18px]" />
          <ToggleSwitch
            checked={comemorarVitorias}
            onChange={setComemorarVitorias}
            label="Comemora comigo as vitórias pequenas"
          />
        </div>

        <div className="w-full text-left mt-4">
          <span className="block font-semibold text-[13px] text-[#5B616E] mb-2">
            Algo que ela deve sempre lembrar de você
          </span>
          <div
            className="bg-surface rounded-[14px] p-[14px_16px] min-h-[78px]"
            style={{ border: "1px solid #D4D8E0" }}
          >
            <textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Ex: sou autônoma, minha renda varia mês a mês…"
              className="w-full border-none outline-none bg-transparent font-medium text-sm text-ink leading-relaxed resize-none font-sans"
              rows={3}
            />
          </div>
        </div>

        <button
          onClick={concluir}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-[22px] cursor-pointer transition-colors hover:bg-brand-600"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          Concluir
        </button>
      </div>
    </div>
  );
}
