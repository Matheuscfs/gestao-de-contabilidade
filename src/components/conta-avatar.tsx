// Avatar de conta. Quando o `icon` corresponde a um banco conhecido, mostra o
// logo do banco (fundo branco) com a cor da conta como uma bandeirinha no canto.
// Quando não há banco vinculado, cai no ícone genérico tingido com a cor.

import { bancoPorNome } from "@/consts/banks";
import { ContaIcon } from "./conta-icon";

interface ContaAvatarProps {
  /** `conta.icon`: nome do banco vinculado ou vazio para genérico. */
  icon: string | null | undefined;
  cor: string;
  size?: number;
  /** Mostra a bandeirinha de cor sobre o logo do banco. */
  flag?: boolean;
}

export function ContaAvatar({ icon, cor, size = 40, flag = true }: ContaAvatarProps) {
  const banco = bancoPorNome(icon);
  const radius = Math.round(size * 0.28);

  if (banco) {
    const flagSize = Math.max(10, Math.round(size * 0.32));
    return (
      <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        <span
          className="flex w-full h-full items-center justify-center overflow-hidden bg-white"
          style={{
            borderRadius: radius,
            border: "1px solid #E3E6EC",
            padding: Math.round(size * 0.16),
          }}
        >
          <img src={banco.icon} alt={banco.name} className="w-full h-full object-contain" />
        </span>
        {flag && (
          <span
            className="absolute rounded-full"
            style={{
              width: flagSize,
              height: flagSize,
              background: cor,
              right: -flagSize * 0.25,
              bottom: -flagSize * 0.25,
              boxShadow: "0 0 0 2px #fff",
            }}
          />
        )}
      </span>
    );
  }

  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: radius, background: `${cor}1A`, color: cor }}
    >
      <ContaIcon icon="bank" size={Math.round(size * 0.5)} />
    </span>
  );
}
