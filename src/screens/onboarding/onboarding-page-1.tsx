import { usePerfilStore } from "@/app/perfil-store";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingStore } from "../../store/onboarding";
import { StepDots } from "./step-dots";

function redimensionarParaBase64(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas não disponível"));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = objectUrl;
  });
}

export function OnboardingNomeScreen() {
  const navigate = useNavigate();
  const { nome, setNome, foto, setFoto } = useOnboardingStore();
  const { atualizarNome, atualizarFoto } = usePerfilStore();
  const [valor, setValor] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const inicial = valor.trim().charAt(0).toUpperCase() || "?";

  async function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await redimensionarParaBase64(file);
      setFoto(base64);
    } catch {
      // falha silenciosa — foto é opcional
    }
  }

  async function avancar() {
    const nomeTrimado = valor.trim();
    setNome(nomeTrimado);
    setSalvando(true);
    try {
      await atualizarNome(nomeTrimado);
      if (foto) await atualizarFoto(foto);
    } catch (e) {
      console.error("[quibo] Erro ao salvar nome/foto:", e);
    } finally {
      setSalvando(false);
    }
    navigate("/onboarding/ia");
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] flex flex-col items-center text-center">
        <StepDots total={4} current={1} concluidos={0} />

        <p className="font-semibold text-[13px] text-[#5B616E] mt-[18px]">
          passo 1 de 4
        </p>

        <h1 className="font-bold text-[30px] leading-tight tracking-[-0.02em] text-ink mt-[10px]">
          Como te chamam?
        </h1>

        <p className="font-medium text-[15px] text-[#5B616E] mt-[10px] leading-relaxed">
          Só o primeiro nome já tá ótimo.
          <br />A foto é totalmente opcional.
        </p>

        {/* Avatar clicável */}
        <div className="relative mt-[30px]">
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            aria-label="Selecionar foto de perfil"
            className="w-[108px] h-[108px] rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            {foto ? (
              <img
                src={foto}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-[38px] select-none">
                {inicial}
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            aria-label="Adicionar foto"
            className="absolute right-[-2px] bottom-[-2px] w-[40px] h-[40px] rounded-full bg-brand text-white flex items-center justify-center cursor-pointer"
            style={{
              border: "3px solid #F7F8FA",
              boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
            }}
          >
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
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={() => inputFotoRef.current?.click()}
          className="font-semibold text-[13px] text-brand mt-3 cursor-pointer hover:underline"
        >
          {foto ? "Trocar foto" : "Adicionar foto"}
        </button>

        {/* Input de arquivo oculto */}
        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={selecionarFoto}
        />

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
              onKeyDown={(e) =>
                e.key === "Enter" && valor.trim() && !salvando && avancar()
              }
            />
          </span>
        </div>

        <button
          onClick={avancar}
          disabled={!valor.trim() || salvando}
          className="w-full h-[52px] rounded-full bg-brand text-white font-semibold text-base mt-[26px] cursor-pointer transition-colors hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          {salvando ? "Salvando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
