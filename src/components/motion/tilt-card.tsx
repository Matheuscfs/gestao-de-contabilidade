import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

/**
 * Card com inclinação 3D que segue o cursor (parallax tátil) + brilho que
 * acompanha o mouse. Sutil de propósito — inclina no máximo ~`max` graus.
 *
 * Não intercepta cliques (os filhos continuam interativos) e respeita
 * `prefers-reduced-motion` (fica estático).
 */
export function TiltCard({
  children,
  className,
  max = 6,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  /** Inclinação máxima em graus. */
  max?: number;
  /** Mostra o brilho que segue o cursor. */
  glare?: boolean;
}) {
  const reduzido = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Posição do cursor dentro do card, normalizada para -0.5..0.5.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const mola = { stiffness: 220, damping: 18, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), mola);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), mola);

  // Brilho posicionado onde está o cursor.
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.35), transparent 55%)`;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduzido) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    px.set(0);
    py.set(0);
  }

  if (reduzido) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={`relative ${className ?? ""}`}
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ background: glareBg }}
          />
        )}
      </motion.div>
    </div>
  );
}
