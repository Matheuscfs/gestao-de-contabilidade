import openFinanceLogo from "@/assets/integration/openfinance.png";
import pluggyLogo from "@/assets/integration/pluggy.svg";
import { BANCOS } from "@/consts/banks";
import { useNavigate } from "react-router-dom";
import { StepDots } from "./step-dots";

const BANCOS_DESTAQUE = ["Nubank", "Itaú", "Bradesco", "Inter", "C6 Bank"];

const bancosDestaque = BANCOS_DESTAQUE.map((nome) =>
  BANCOS.find((b) => b.name === nome),
).filter(Boolean) as typeof BANCOS;

const totalBancos = BANCOS.length;

export function OnboardingBancoScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[430px] flex flex-col items-center text-center">
        <StepDots total={5} current={3} concluidos={2} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 3 de 5 · opcional
        </p>

        <h1 className="font-bold text-[28px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Traga seus dados reais
        </h1>

        <p className="font-medium text-[14px] text-[#5B616E] mt-[8px] leading-relaxed">
          Opções de integração com empresas de conexão bancária.
        </p>

        {/* Card Pluggy + OpenFinance */}
        <div
          className="w-full rounded-2xl p-4 mt-[20px]"
          style={{ background: "#F8F9FB", border: "1px solid #E3E6EC" }}
        >
          {/* Logos lado a lado */}
          <div className="flex items-center justify-center gap-3">
            <img
              src={pluggyLogo}
              alt="Pluggy"
              className="h-[22px] object-contain"
            />
            <div className="w-px h-5 bg-border" />
            <img
              src={openFinanceLogo}
              alt="Open Finance"
              className="h-[18px] object-contain"
            />
          </div>

          <p className="font-medium text-[12.5px] text-ink-secondary mt-3 leading-relaxed">
            A integração é feita pelo{" "}
            <strong className="text-ink">Pluggy</strong>, parceiro certificado
            do Open Finance. Seus dados criptografados de forma segura.
          </p>
        </div>

        {/* Logos dos bancos */}
        <div className="flex items-center gap-[10px] mt-[20px]">
          {bancosDestaque.map((banco) => (
            <div
              key={banco.name}
              title={banco.name}
              className="w-[50px] h-[50px] rounded-[14px] bg-surface border border-border flex items-center justify-center overflow-hidden p-[10px]"
            >
              <img
                src={banco.icon}
                alt={banco.name}
                className="w-full h-full object-contain"
              />
            </div>
          ))}

          <div className="w-[50px] h-[50px] rounded-[14px] bg-surface border border-border flex items-center justify-center">
            <span className="font-bold text-[12px] text-ink-secondary">
              +{totalBancos - bancosDestaque.length}
            </span>
          </div>
        </div>

        <p className="font-medium text-[12px] text-ink-muted mt-2">
          {totalBancos}+ bancos e fintechs suportados
        </p>

        <button
          onClick={() => navigate("/onboarding/meta")}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-6 cursor-pointer transition-colors hover:bg-brand-600"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
