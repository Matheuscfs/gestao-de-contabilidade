import quiboMark from "@/assets/quibo-mark.png";
import { useNavigate } from "react-router-dom";

export function OnboardingBoasVindasScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[440px] flex flex-col items-center text-center">
        <img
          src={quiboMark}
          alt="Quibo"
          className="w-[72px] h-[72px] object-contain"
        />

        <h1 className="font-bold text-[34px] leading-tight tracking-[-0.02em] text-ink mt-6">
          Oi! Bem-vindo ao Quibo.
        </h1>

        <p className="font-medium text-base text-[#5B616E] mt-3 leading-relaxed">
          Sua vida financeira organizada de verdade.
          <br />
          Um número que importa, um toque pra confirmar.
        </p>

        <div className="w-full mt-8 flex flex-col gap-3">
          <div className="flex items-center gap-[14px] bg-surface border border-[#E3E6EC] rounded-2xl p-4 text-left">
            <div className="w-[38px] h-[38px] rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
            </div>
            <p className="font-medium text-sm text-ink">
              Tudo gira em torno do mês, sem planilha, sem susto.
            </p>
          </div>

          <div className="flex items-center gap-[14px] bg-surface border border-[#E3E6EC] rounded-2xl p-4 text-left">
            <div className="w-[38px] h-[38px] rounded-xl bg-positive-50 text-positive flex items-center justify-center shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <p className="font-medium text-sm text-ink">
              Confirma transações de forma natural e simples.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate("/onboarding/nome")}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-7 cursor-pointer transition-colors hover:bg-brand-600"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          Bora começar
        </button>

        <p className="font-medium text-[13px] text-ink-muted mt-4">
          Clique no botão acima para começar.
        </p>
      </div>
    </div>
  );
}
