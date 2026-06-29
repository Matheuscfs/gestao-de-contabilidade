import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingStore } from "../../store/onboarding";
import { usePerfilStore } from "@/app/perfil-store";

export function OnboardingTudoProntoScreen() {
  const navigate = useNavigate();
  const { concluirOnboarding } = useOnboardingStore();
  const { nome } = usePerfilStore();
  const [carregando, setCarregando] = useState(false);

  const primeiroNome = nome.trim().split(" ")[0] || "você";

  async function verMeuMes() {
    setCarregando(true);
    try {
      await concluirOnboarding();
    } catch (e) {
      console.error("[quibo] Erro ao concluir onboarding:", e);
    }
    navigate("/mes", { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] flex flex-col items-center text-center">
        <div className="w-[92px] h-[92px] rounded-full bg-positive-50 text-positive flex items-center justify-center">
          <svg
            width="46"
            height="46"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h1 className="font-bold text-[32px] leading-tight tracking-[-0.02em] text-ink mt-6">
          Tá tudo pronto, {primeiroNome}.
        </h1>

        <p className="font-medium text-base text-[#5B616E] mt-3 leading-relaxed">
          Seu primeiro mês já tá te esperando.
          <br />
          Respira — a gente cuida do resto.
        </p>

        <button
          onClick={verMeuMes}
          disabled={carregando}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-[30px] cursor-pointer transition-colors hover:bg-brand-600 disabled:opacity-70 disabled:cursor-not-allowed"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          {carregando ? "Entrando…" : "Ver meu mês"}
        </button>

        <p className="font-medium text-[13px] text-ink-muted mt-4">
          Dá pra ajustar tudo isso no seu perfil quando quiser.
        </p>
      </div>
    </div>
  );
}
