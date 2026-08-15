import claudeLogo from "@/assets/ai/claude.svg";
import geminiLogo from "@/assets/ai/gemini.svg";
import openaiLogo from "@/assets/ai/openai.svg";
import openrouterLogo from "@/assets/ai/openrouter.svg";
import { useNavigate } from "react-router-dom";
import { StepDots } from "./step-dots";

interface CardIAProps {
  logo: string;
  logoAlt: string;
  logoBg: string;
  nome: string;
  tagline: string;
}

function CardIA({ logo, logoAlt, logoBg, nome, tagline }: CardIAProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 text-left">
      <div
        className="w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0"
        style={{ background: logoBg }}
      >
        <img
          src={logo}
          alt={logoAlt}
          className="w-[22px] h-[22px] object-contain"
        />
      </div>
      <div>
        <p className="font-bold text-[14px] text-ink leading-tight">{nome}</p>
        <p className="font-semibold text-[11.5px] text-brand mt-0.5">
          {tagline}
        </p>
      </div>
    </div>
  );
}

const PROVEDORES: CardIAProps[] = [
  {
    logo: openaiLogo,
    logoAlt: "OpenAI",
    logoBg: "#F0F0F0",
    nome: "OpenAI · GPT",
    tagline: "Rápido e versátil",
  },
  {
    logo: claudeLogo,
    logoAlt: "Anthropic Claude",
    logoBg: "#FFF1EC",
    nome: "Anthropic · Claude",
    tagline: "Raciocínio profundo",
  },
  {
    logo: geminiLogo,
    logoAlt: "Google Gemini",
    logoBg: "#EEF4FF",
    nome: "Google · Gemini",
    tagline: "Contexto longo",
  },
  {
    logo: openrouterLogo,
    logoAlt: "OpenRouter",
    logoBg: "#F2F2F2",
    nome: "OpenRouter",
    tagline: "Muitos modelos, uma chave",
  },
];

export function OnboardingIAScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[440px] flex flex-col items-center text-center">
        <StepDots total={4} current={2} concluidos={1} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 2 de 4 · opcional
        </p>

        <h1 className="font-bold text-[28px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Gestão de Contabilidade tem IA integrada
        </h1>

        <p className="font-medium text-[14px] text-[#5B616E] mt-[8px] leading-relaxed">
          Conecte seu provedor e a IA lê seu mês com{" "}
          <strong className="text-ink">seu</strong> contexto real.
          <br />
          Você dá a chave, tudo fica no seu dispositivo.
        </p>

        {/* Grid 2×2 */}
        <div className="w-full mt-[20px] grid grid-cols-2 gap-[10px]">
          {PROVEDORES.map((p) => (
            <CardIA key={p.nome} {...p} />
          ))}
        </div>

        {/* Badge de privacidade */}
        <div className="flex items-center gap-2 mt-[14px] text-ink-muted font-medium text-[12px]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
          Sua chave fica criptografada no keychain do sistema.
        </div>

        <button
          onClick={() => navigate("/onboarding/banco")}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-5 cursor-pointer transition-colors hover:bg-brand-600"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
