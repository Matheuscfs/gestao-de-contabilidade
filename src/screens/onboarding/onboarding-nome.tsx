import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingStore } from "./onboarding-store";
import { StepDots } from "./step-dots";

export function OnboardingNomeScreen() {
  const navigate = useNavigate();
  const { nome, setNome } = useOnboardingStore();
  const [valor, setValor] = useState(nome);

  const inicial = valor.trim().charAt(0).toUpperCase() || "?";

  function avancar() {
    setNome(valor.trim());
    navigate("/onboarding/ia");
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] flex flex-col items-center text-center">
        <StepDots total={5} current={1} concluidos={0} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 1 de 5
        </p>

        <h1 className="font-bold text-[30px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Como te chamam?
        </h1>

        <p className="font-medium text-[15px] text-[#5B616E] mt-[10px] leading-relaxed">
          Só o primeiro nome já tá ótimo.
          <br />
          A foto é totalmente opcional.
        </p>

        <div className="relative mt-[30px]">
          <div
            className="w-[108px] h-[108px] rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-[38px] select-none"
          >
            {inicial}
          </div>
          <button
            aria-label="Adicionar foto"
            className="absolute right-[-2px] bottom-[-2px] w-[40px] h-[40px] rounded-full bg-brand text-white flex items-center justify-center cursor-pointer"
            style={{
              border: "3px solid #F7F8FA",
              boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </button>
        </div>

        <span className="font-semibold text-[13px] text-brand mt-3 cursor-pointer">
          Adicionar foto
        </span>

        <div className="w-full mt-6">
          <span
            className="flex items-center h-[62px] px-[18px] bg-surface rounded-[14px]"
            style={{
              border: "1px solid #4078E6",
              boxShadow: "0 0 0 3px #EAF1FD",
            }}
          >
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Seu nome"
              autoFocus
              className="flex-1 min-w-0 border-none outline-none bg-transparent font-semibold text-[20px] text-ink text-center font-sans"
              onKeyDown={(e) => e.key === "Enter" && valor.trim() && avancar()}
            />
          </span>
        </div>

        <button
          onClick={avancar}
          disabled={!valor.trim()}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-[26px] cursor-pointer transition-colors hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
