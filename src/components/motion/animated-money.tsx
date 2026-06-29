import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { formatarBRL } from "@/utils/money";

/**
 * Valor monetário que "conta" suavemente do valor anterior até o novo,
 * usando a mesma formatação BRL do resto do app (centavos → "R$ 1.847,00").
 *
 * Respeita `prefers-reduced-motion`: sem animação, mostra o valor direto.
 */
export function AnimatedMoney({
  cents,
  className,
  duration = 0.9,
}: {
  cents: number;
  className?: string;
  /** Duração da contagem em segundos. */
  duration?: number;
}) {
  const reduzido = useReducedMotion();
  const motionValue = useMotionValue(cents);
  const texto = useTransform(motionValue, (v) => formatarBRL(Math.round(v)));

  useEffect(() => {
    if (reduzido) {
      motionValue.set(cents);
      return;
    }
    const controls = animate(motionValue, cents, {
      duration,
      ease: [0.22, 1, 0.36, 1], // easeOutQuint — desacelera no fim
    });
    return () => controls.stop();
  }, [cents, duration, motionValue, reduzido]);

  return <motion.span className={className}>{texto}</motion.span>;
}
