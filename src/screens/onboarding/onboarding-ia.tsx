import { useNavigate } from "react-router-dom";
import { useOnboardingStore, type ProvedorIA } from "./onboarding-store";
import { StepDots } from "./step-dots";

interface OpcaoIAProps {
  selecionado: boolean;
  onClick: () => void;
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
}

function OpcaoIA({ selecionado, onClick, titulo, descricao, icone }: OpcaoIAProps) {
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
      <div className="w-[42px] h-[42px] rounded-xl bg-[#F0F2F6] text-ink flex items-center justify-center shrink-0">
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

const sparkleIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </svg>
);

const geminiIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="16" x="4" y="4" rx="2" />
    <rect width="6" height="6" x="9" y="9" rx="1" />
    <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
  </svg>
);

export function OnboardingIAScreen() {
  const navigate = useNavigate();
  const { provedorIA, setProvedorIA } = useOnboardingStore();

  function selecionar(p: ProvedorIA) {
    setProvedorIA(p === provedorIA ? null : p);
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[430px] flex flex-col items-center text-center">
        <StepDots total={5} current={2} concluidos={1} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 2 de 5 · opcional
        </p>

        <h1 className="font-bold text-[30px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Quer uma IA lendo seu mês?
        </h1>

        <p className="font-medium text-[15px] text-[#5B616E] mt-[10px] leading-relaxed">
          Ela te aconselha com o <strong className="text-ink">seu</strong> contexto — não palpite genérico.
          Você dá a chave, fica tudo no seu navegador.
        </p>

        <div className="w-full mt-[22px] flex flex-col gap-[10px]">
          <OpcaoIA
            selecionado={provedorIA === "openai"}
            onClick={() => selecionar("openai")}
            titulo="OpenAI · GPT-4o"
            descricao="resumos do mês e conselhos rápidos"
            icone={sparkleIcon}
          />
          <OpcaoIA
            selecionado={provedorIA === "anthropic"}
            onClick={() => selecionar("anthropic")}
            titulo="Anthropic · Claude"
            descricao="raciocínio cuidadoso pra decisões maiores"
            icone={sparkleIcon}
          />
          <OpcaoIA
            selecionado={provedorIA === "gemini"}
            onClick={() => selecionar("gemini")}
            titulo="Google Gemini"
            descricao="bom pra gráficos e leitura de extratos"
            icone={geminiIcon}
          />
        </div>

        <div className="flex items-center gap-2 mt-[14px] text-ink-muted font-medium text-[12.5px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
          Sua chave fica criptografada — você revoga quando quiser.
        </div>

        <button
          onClick={() => navigate("/onboarding/banco")}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-5 cursor-pointer transition-colors hover:bg-brand-600"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          Continuar
        </button>

        <button
          onClick={() => {
            setProvedorIA(null);
            navigate("/onboarding/banco");
          }}
          className="h-11 bg-transparent border-none text-[#5B616E] font-semibold text-sm cursor-pointer mt-2 hover:text-ink transition-colors"
        >
          Agora não, conecto depois
        </button>
      </div>
    </div>
  );
}
