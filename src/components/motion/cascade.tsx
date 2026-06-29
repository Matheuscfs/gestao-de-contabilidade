import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

/**
 * Entrada em cascata com profundidade: os filhos "assentam" um após o outro,
 * subindo e inclinando levemente em 3D — como cartas caindo numa mesa.
 *
 * Uso:
 *   <Cascade className="space-y-4">
 *     <CascadeItem><Card /></CascadeItem>
 *     <CascadeItem><Card /></CascadeItem>
 *   </Cascade>
 */

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18, rotateX: -10, transformPerspective: 800 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transformPerspective: 800,
    transition: { type: "spring", stiffness: 320, damping: 26, mass: 0.7 },
  },
};

export function Cascade({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduzido = useReducedMotion();
  if (reduzido) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      animate="show"
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}

export function CascadeItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduzido = useReducedMotion();
  if (reduzido) return <div className={className}>{children}</div>;
  return (
    <motion.div variants={item} className={className} style={{ transformStyle: "preserve-3d" }}>
      {children}
    </motion.div>
  );
}
