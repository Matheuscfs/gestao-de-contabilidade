/**
 * Painel de pendências de cadastro, no topo da lista de empresas.
 *
 * Existe porque as 24 empresas vieram da planilha sem anexo do Simples e sem
 * valor de pró-labore, e a aba Tributos ficava muda sem dizer por quê. Aqui a
 * lacuna aparece e se resolve no mesmo lugar — abrir 21 formulários completos
 * para preencher um campo em cada não é opção.
 */

import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import type { AnexoSimples } from "@/core/db/empresas";
import {
  definirAnexoSimples,
  definirProLabore,
  type PendenciaEmpresa,
  type TipoPendencia,
} from "@/core/db/pendencias-cadastro";
import { PRO_LABORE_MINIMO_CENTS } from "@/consts/tributos";
import { formatarCNPJ } from "@/utils/documento";
import { formatarBRL } from "@/utils/money";

const ANEXOS: { valor: AnexoSimples; dica: string }[] = [
  { valor: "I", dica: "Comércio" },
  { valor: "II", dica: "Indústria" },
  { valor: "III", dica: "Serviços com Fator R ≥ 28%" },
  { valor: "IV", dica: "Construção, advocacia, limpeza, vigilância" },
  { valor: "V", dica: "Serviços com Fator R < 28%" },
];

const ROTULO_PENDENCIA: Record<TipoPendencia, string> = {
  ANEXO_SIMPLES: "sem anexo",
  PRO_LABORE: "pró-labore sem valor",
  RECEITA_SEM_LANCAMENTO: "sem receita lançada",
};

// ─── Linha de uma empresa ─────────────────────────────────────────────────────

function LinhaEmpresa({
  pendencia,
  onCorrigido,
}: {
  pendencia: PendenciaEmpresa;
  onCorrigido: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [proLabores, setProLabores] = useState<Record<string, number>>(() =>
    Object.fromEntries(pendencia.socios.map((s) => [s.vinculoId, s.proLaboreCents]))
  );

  const precisaAnexo = pendencia.faltando.includes("ANEXO_SIMPLES");
  const precisaProLabore = pendencia.faltando.includes("PRO_LABORE");

  async function executar(acao: () => Promise<void>, contexto: string) {
    setSalvando(true);
    try {
      await acao();
      onCorrigido();
    } catch (e) {
      tratarErro(e, { contexto, mensagemUsuario: "Não foi possível salvar." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "#F0E3C6" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#FCF7EC] transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[14px] text-ink truncate">
            {pendencia.nomeExibicao}
          </p>
          <p className="text-[12px] text-ink-muted tabular-nums">
            {formatarCNPJ(pendencia.cnpj)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
          {pendencia.faltando.map((f) => (
            <span
              key={f}
              className="inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-semibold"
              style={{ background: "#F6E7C6", color: "#8A6115" }}
            >
              {ROTULO_PENDENCIA[f]}
            </span>
          ))}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#B9791C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-4">
          {precisaAnexo && (
            <div>
              <p className="text-[12.5px] font-semibold text-ink-secondary mb-2">
                Anexo do Simples Nacional
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ANEXOS.map((a) => (
                  <button
                    key={a.valor}
                    disabled={salvando}
                    title={a.dica}
                    onClick={() =>
                      executar(async () => {
                        await definirAnexoSimples(pendencia.empresaId, a.valor);
                        toast.sucesso(
                          `${pendencia.nomeExibicao}: Anexo ${a.valor}`
                        );
                      }, "definir anexo do Simples")
                    }
                    className="h-[34px] px-3 rounded-full font-semibold text-[13px] transition-colors disabled:opacity-50"
                    style={{ border: "1px solid #E3E6EC", background: "#fff", color: "#0E1116" }}
                  >
                    Anexo {a.valor}
                    <span className="font-normal text-ink-muted"> · {a.dica}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11.5px] text-ink-muted mt-1.5">
                Serviços: escolha III ou V pela atividade — o app recalcula o
                Fator R depois e avisa se o outro anexo for o indicado.
              </p>
            </div>
          )}

          {precisaProLabore && (
            <div>
              <p className="text-[12.5px] font-semibold text-ink-secondary mb-1">
                Pró-labore mensal
              </p>
              <p className="text-[11.5px] text-ink-muted mb-2">
                Esta empresa já teve guia de INSS emitida, então há retirada — só
                falta o valor. Piso de {formatarBRL(PRO_LABORE_MINIMO_CENTS)} para
                sócio que atua na empresa.
              </p>
              <div className="flex flex-col gap-2">
                {pendencia.socios.length === 0 && (
                  <p className="text-[12.5px] text-ink-muted">
                    Nenhum sócio vinculado — cadastre o sócio na aba Sócios da
                    empresa antes de informar o pró-labore.
                  </p>
                )}
                {pendencia.socios.map((s) => (
                  <div key={s.vinculoId} className="flex items-center gap-2.5">
                    <span className="text-[13px] text-ink flex-1 min-w-0 truncate">
                      {s.nome}
                      {s.isAdministrador && (
                        <span className="text-ink-muted"> · admin</span>
                      )}
                    </span>
                    <div className="w-[150px] shrink-0">
                      <MoneyInput
                        centavos={proLabores[s.vinculoId] ?? 0}
                        onChange={(v) =>
                          setProLabores((p) => ({ ...p, [s.vinculoId]: v }))
                        }
                        aria-label={`Pró-labore de ${s.nome}`}
                      />
                    </div>
                    <button
                      disabled={salvando || (proLabores[s.vinculoId] ?? 0) === 0}
                      onClick={() =>
                        executar(async () => {
                          await definirProLabore(
                            s.vinculoId,
                            proLabores[s.vinculoId] ?? 0
                          );
                          toast.sucesso(`Pró-labore de ${s.nome} registrado`);
                        }, "definir pró-labore")
                      }
                      className="shrink-0 h-[38px] px-3.5 rounded-full text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
                      style={{ background: "#4078E6" }}
                    >
                      Salvar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendencia.faltando.includes("RECEITA_SEM_LANCAMENTO") && (
            <p className="text-[12.5px] text-ink-muted">
              Sem receita lançada não há RBT12, e sem RBT12 não existe alíquota
              efetiva. Lance na aba Tributos da empresa.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Painel ───────────────────────────────────────────────────────────────────

export function PainelPendencias({
  pendencias,
  onCorrigido,
}: {
  pendencias: PendenciaEmpresa[];
  onCorrigido: () => void;
}) {
  const [recolhido, setRecolhido] = useState(false);

  if (pendencias.length === 0) return null;

  const semAnexo = pendencias.filter((p) =>
    p.faltando.includes("ANEXO_SIMPLES")
  ).length;
  const semProLabore = pendencias.filter((p) =>
    p.faltando.includes("PRO_LABORE")
  ).length;

  const resumo = [
    semAnexo > 0 && `${semAnexo} sem anexo do Simples`,
    semProLabore > 0 && `${semProLabore} com pró-labore sem valor`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: "#FDFAF3", border: "1px solid #F0E3C6" }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold" style={{ color: "#8A6115" }}>
            {pendencias.length} empresa{pendencias.length > 1 ? "s" : ""} com
            cadastro incompleto
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: "#96703A" }}>
            {resumo || "Faltam dados para calcular"} — sem isso a aba Tributos
            não consegue estimar o DAS nem o Fator R.
          </p>
        </div>
        <button
          onClick={() => setRecolhido((v) => !v)}
          className="shrink-0 text-[12.5px] font-semibold hover:underline"
          style={{ color: "#8A6115" }}
        >
          {recolhido ? "Mostrar" : "Ocultar"}
        </button>
      </div>

      {!recolhido && (
        <div style={{ borderTop: "1px solid #F0E3C6" }}>
          {pendencias.map((p) => (
            <LinhaEmpresa
              key={p.empresaId}
              pendencia={p}
              onCorrigido={onCorrigido}
            />
          ))}
        </div>
      )}
    </div>
  );
}
