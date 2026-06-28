import { useNavigate } from "react-router-dom";
import { StepDots } from "./step-dots";

const bancos = [
  { sigla: "Nu", bg: "#820AD1" },
  { sigla: "It", bg: "#EC7000" },
  { sigla: "in", bg: "#FF7A00" },
  { sigla: "Br", bg: "#CC092F" },
  { sigla: "Cx", bg: "#1B5EAE" },
];

export function OnboardingBancoScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[430px] flex flex-col items-center text-center">
        <StepDots total={5} current={3} concluidos={2} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 3 de 5 · opcional
        </p>

        <h1 className="font-bold text-[30px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Conectar seu banco?
        </h1>

        <p className="font-medium text-[15px] text-[#5B616E] mt-[10px] leading-relaxed">
          Pelo Pluggy, o Quibo lê seus lançamentos com segurança.
          Você só confirma — a gente nunca move seu dinheiro.
        </p>

        <div
          className="w-full flex items-center gap-[14px] rounded-2xl p-4 mt-[22px] text-left"
          style={{ background: "#EAF1FD", border: "1px solid #D5E4FB" }}
        >
          <div className="w-[42px] h-[42px] rounded-xl bg-surface text-brand-700 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            </svg>
          </div>
          <p className="font-medium text-[13px] leading-[1.45]" style={{ color: "#1F3D7A" }}>
            <strong style={{ color: "#16336E" }}>Open Finance, regulado pelo Banco Central.</strong>{" "}
            Conexão só de leitura — dá pra desconectar a qualquer hora.
          </p>
        </div>

        <div className="flex flex-wrap gap-[10px] justify-center mt-[18px]">
          {bancos.map(({ sigla, bg }) => (
            <div
              key={sigla}
              className="w-[54px] h-[54px] rounded-[15px] flex items-center justify-center font-bold text-[17px] text-white"
              style={{ background: bg }}
            >
              {sigla}
            </div>
          ))}
          <div className="w-[54px] h-[54px] rounded-[15px] bg-[#F0F2F6] text-[#5B616E] flex items-center justify-center font-bold text-[17px]">
            +30
          </div>
        </div>

        <button
          onClick={() => navigate("/onboarding/meta")}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-6 cursor-pointer transition-colors hover:bg-brand-600 flex items-center justify-center gap-[9px]"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Conectar pelo Pluggy
        </button>

        <button
          onClick={() => navigate("/onboarding/meta")}
          className="h-11 bg-transparent border-none text-[#5B616E] font-semibold text-sm cursor-pointer mt-2 hover:text-ink transition-colors"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
