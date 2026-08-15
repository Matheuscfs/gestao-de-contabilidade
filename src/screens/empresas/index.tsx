/**
 * Empresas — listagem do módulo contábil.
 *
 * Cada card leva ao detalhe da empresa (dados, sócios e funcionários).
 * O botão "Adicionar" do header abre o cadastro de nova empresa.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { tratarErro } from "@/core/errors";
import {
  listarEmpresas,
  LABEL_REGIME,
  type EmpresaComTotais,
} from "@/core/db/empresas";
import { contarPendencias } from "@/core/db/obrigacoes";
import { contarProcessosAtivos } from "@/core/db/processos";
import { formatarCNPJ } from "@/utils/documento";
import { formatarBRL } from "@/utils/money";
import { ModalEmpresa } from "./modal-empresa";

// ─── Card de empresa ──────────────────────────────────────────────────────────

const COR_STATUS: Record<string, { bg: string; cor: string; texto: string }> = {
  ATIVA: { bg: "#E2F4EC", cor: "#0E885A", texto: "ativa" },
  INATIVA: { bg: "#FCF1DF", cor: "#B9791C", texto: "inativa" },
  BAIXADA: { bg: "#F0F2F6", cor: "#5B616E", texto: "baixada" },
};

function CardEmpresa({
  empresa,
  pendencias,
  processosAtivos,
  onAbrir,
}: {
  empresa: EmpresaComTotais;
  pendencias: { pendentes: number; atrasadas: number } | null;
  processosAtivos: number;
  onAbrir: () => void;
}) {
  const chipStatus = COR_STATUS[empresa.status] ?? COR_STATUS.ATIVA;
  const regimeLabel =
    empresa.regimeTributario === "SIMPLES" && empresa.anexoSimples
      ? `${LABEL_REGIME.SIMPLES} · Anexo ${empresa.anexoSimples}`
      : LABEL_REGIME[empresa.regimeTributario];

  return (
    <button
      onClick={onAbrir}
      aria-label={`Abrir ${empresa.razaoSocial}`}
      className="group bg-surface border border-border rounded-2xl p-5 flex flex-col text-left hover:border-brand/40 hover:shadow-[0_8px_24px_-12px_rgba(14,17,22,.22)] transition-all"
      style={{ borderColor: "#E3E6EC" }}
    >
      {/* Ícone + status */}
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "#EAF1FD", color: "#2F63C9" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
          </svg>
        </div>
        <span
          className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold"
          style={{ background: chipStatus.bg, color: chipStatus.cor }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
          {chipStatus.texto}
        </span>
      </div>

      {/* Nome + CNPJ */}
      <p className="font-bold text-[16px] text-ink tracking-tight mt-3.5 truncate w-full">
        {empresa.nomeFantasia || empresa.razaoSocial}
      </p>
      {empresa.nomeFantasia && (
        <p className="text-[13px] text-ink-secondary truncate w-full">
          {empresa.razaoSocial}
        </p>
      )}
      <p className="text-[13px] text-ink-muted tabular-nums mt-0.5">
        {formatarCNPJ(empresa.cnpj)}
      </p>

      {/* Regime */}
      <span
        className="self-start inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold mt-3"
        style={{ background: "#F0F2F6", color: "#5B616E" }}
      >
        {regimeLabel}
      </span>

      {/* Rodapé: sócios / funcionários / pró-labore */}
      <div className="h-px bg-border-subtle w-full mt-4" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[12.5px] font-medium text-ink-secondary">
        <span>
          {empresa.sociosCount} sócio{empresa.sociosCount === 1 ? "" : "s"}
        </span>
        <span>
          {empresa.temFuncionarios || empresa.funcionariosCount > 0
            ? `${empresa.funcionariosCount > 0 ? empresa.funcionariosCount : "com"} funcionário${empresa.funcionariosCount === 1 ? "" : "s"}`
            : "sem funcionários"}
        </span>
        {empresa.proLaboreTotalCents > 0 && (
          <span title="Soma dos pró-labores mensais dos sócios">
            pró-labore {formatarBRL(empresa.proLaboreTotalCents)}
          </span>
        )}
        {pendencias && pendencias.pendentes > 0 && (
          <span
            className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full text-[11px] font-bold"
            style={
              pendencias.atrasadas > 0
                ? { background: "#FBE9E7", color: "#C0413B" }
                : { background: "#FCF1DF", color: "#B9791C" }
            }
            title={
              pendencias.atrasadas > 0
                ? `${pendencias.atrasadas} obrigação(ões) em atraso`
                : "Obrigações pendentes na agenda"
            }
          >
            {pendencias.atrasadas > 0
              ? `${pendencias.atrasadas} em atraso`
              : `${pendencias.pendentes} pendente${pendencias.pendentes === 1 ? "" : "s"}`}
          </span>
        )}
        {processosAtivos > 0 && (
          <span
            className="inline-flex items-center gap-1 h-[20px] px-2 rounded-full text-[11px] font-bold"
            style={{ background: "#EAF1FD", color: "#2F63C9" }}
            title="Processos em andamento"
          >
            {processosAtivos} processo{processosAtivos === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function EmpresasScreen() {
  const [empresas, setEmpresas] = useState<EmpresaComTotais[]>([]);
  const [pendencias, setPendencias] = useState<
    Record<string, { pendentes: number; atrasadas: number }>
  >({});
  const [processosAtivos, setProcessosAtivos] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const navigate = useNavigate();
  const { setOnAdicionar } = useHeaderActionsStore();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, pend, proc] = await Promise.all([
        listarEmpresas(),
        contarPendencias(),
        contarProcessosAtivos(),
      ]);
      setEmpresas(lista);
      setPendencias(pend);
      setProcessosAtivos(proc);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar empresas",
        mensagemUsuario: "Não foi possível carregar as empresas.",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirModalNovo = useCallback(() => setModalAberto(true), []);

  useEffect(() => {
    setOnAdicionar(abrirModalNovo);
    return () => setOnAdicionar(null);
  }, [abrirModalNovo, setOnAdicionar]);

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "860px", margin: "0 auto", width: "100%", paddingTop: "6px" }}
    >
      {/* Header */}
      <div className="px-0.5 pb-0">
        <h1
          style={{
            fontWeight: 700,
            fontSize: "24px",
            letterSpacing: "-0.02em",
            color: "#0E1116",
          }}
        >
          Suas empresas
        </h1>
        <p
          style={{
            fontWeight: 500,
            fontSize: "15px",
            color: "#5B616E",
            marginTop: "6px",
          }}
        >
          Cadastro, sócios, funcionários e regime tributário de cada uma — a base
          para acompanhar obrigações e impostos.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
          Carregando…
        </div>
      ) : empresas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm font-medium text-ink-muted">
            Nenhuma empresa cadastrada ainda.
          </p>
          <button
            onClick={abrirModalNovo}
            className="mt-1 text-sm font-semibold text-brand hover:underline"
          >
            Adicionar a primeira
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 mt-5">
          {empresas.map((e) => (
            <CardEmpresa
              key={e.id}
              empresa={e}
              pendencias={pendencias[e.id] ?? null}
              processosAtivos={processosAtivos[e.id] ?? 0}
              onAbrir={() => navigate(`/empresas/${e.id}`)}
            />
          ))}
        </div>
      )}

      {modalAberto && (
        <ModalEmpresa
          editando={null}
          onSalvo={(id) => {
            setModalAberto(false);
            navigate(`/empresas/${id}`);
          }}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}
