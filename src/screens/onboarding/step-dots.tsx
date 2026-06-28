interface StepDotsProps {
  total: number;
  current: number;
  concluidos: number;
}

export function StepDots({ total, current, concluidos }: StepDotsProps) {
  return (
    <div className="flex items-center gap-[7px]">
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i + 1 === current;
        const isDone = i + 1 <= concluidos;

        return (
          <span
            key={i}
            style={{
              width: isCurrent ? "22px" : "7px",
              height: "7px",
              borderRadius: "99px",
              background: isCurrent ? "#4078E6" : isDone ? "#12A06B" : "#D4D8E0",
              display: "inline-block",
              transition: "width 0.2s ease",
            }}
          />
        );
      })}
    </div>
  );
}
