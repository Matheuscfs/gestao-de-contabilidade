import { useState, useEffect, useCallback } from "react";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  SUBTIPOS_DIVIDA as SUBTIPOS,
  labelSubtipoDivida as labelSubtipo,
  type SubTipoDivida as SubTipo,
} from "@/consts/dividas";
import { formatarBRL } from "@/utils/money";
import {
  listarDividas,
  criarDivida,
  editarDivida,
  excluirDivida,
  type Divida,
} from "@/core/db/dividas";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type Filtro = "todas" | "aberto" | "quitadas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computarStats(lista: Divida[]) {
  const ativas = lista.filter((d) => d.status === "ATIVO");
  const totalEmAberto = ativas.reduce(
    (soma, d) => soma + (d.amountCents ?? 0) * (d.dbtRemainingInstallments ?? 0),
    0
  );
  const pagamentoMensal = ativas.reduce(
    (soma, d) => soma + (d.amountCents ?? 0),
    0
  );
  return { totalEmAberto, pagamentoMensal, parcelasAtivas: ativas.length };
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IconEditar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconExcluir() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconFechar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function DividasScreen() {
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  // Estado do modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Divida | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  // Campos do formulário
  const [descricao, setDescricao] = useState("");
  const [subtipo, setSubtipo] = useState<SubTipo>("LOAN");
  const [parcelaCentavos, setParcelaCentavos] = useState(0);
  const [totalParcelas, setTotalParcelas] = useState(12);
  const [parcelasPagas, setParcelasPagas] = useState(0);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [taxaJuros, setTaxaJuros] = useState("");
  const [statusEdicao, setStatusEdicao] = useState<"ATIVO" | "PAGO">("ATIVO");

  const { setOnAdicionar } = useHeaderActionsStore();

  // ─── Dados ─────────────────────────────────────────────────────────────────

  const carregarDividas = useCallback(async () => {
    try {
      setCarregando(true);
      const lista = await listarDividas();
      setDividas(lista);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar dívidas",
        mensagemUsuario: "Não foi possível carregar as dívidas.",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDividas();
  }, [carregarDividas]);

  // ─── Abertura do modal ─────────────────────────────────────────────────────

  const abrirModalCriar = useCallback(() => {
    setEditando(null);
    setDescricao("");
    setSubtipo("LOAN");
    setParcelaCentavos(0);
    setTotalParcelas(12);
    setParcelasPagas(0);
    setDiaVencimento(10);
    setTaxaJuros("");
    setStatusEdicao("ATIVO");
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }, []);

  useEffect(() => {
    setOnAdicionar(abrirModalCriar);
    return () => setOnAdicionar(null);
  }, [abrirModalCriar, setOnAdicionar]);

  function abrirModalEditar(d: Divida) {
    setEditando(d);
    setDescricao(d.description);
    setSubtipo((d.dbtSubType as SubTipo) ?? "OUTRO");
    setParcelaCentavos(d.amountCents ?? 0);
    setTotalParcelas(d.dbtTotalInstallments ?? 1);
    setParcelasPagas(
      (d.dbtTotalInstallments ?? 0) - (d.dbtRemainingInstallments ?? 0)
    );
    setDiaVencimento(d.dbtInstallmentDay ?? 10);
    setTaxaJuros(d.dbtInterestRate ? String(d.dbtInterestRate) : "");
    setStatusEdicao((d.status as "ATIVO" | "PAGO") === "PAGO" ? "PAGO" : "ATIVO");
    setConfirmandoExclusao(false);
    setErroModal(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditando(null);
    setConfirmandoExclusao(false);
    setErroModal(null);
  }

  // ─── Salvar / Excluir ──────────────────────────────────────────────────────

  const podeSalvar =
    descricao.trim().length > 0 &&
    parcelaCentavos > 0 &&
    totalParcelas >= 1 &&
    parcelasPagas >= 0 &&
    parcelasPagas <= totalParcelas &&
    diaVencimento >= 1 &&
    diaVencimento <= 31;

  async function handleSalvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const taxaStr = taxaJuros.trim().replace(",", ".");
      const taxa = taxaStr ? parseFloat(taxaStr) : null;
      const dados = {
        description: descricao,
        amountCents: parcelaCentavos,
        dbtSubType: subtipo,
        dbtTotalInstallments: totalParcelas,
        parcelasPagas,
        dbtInstallmentDay: diaVencimento,
        dbtInterestRate: taxa !== null && !isNaN(taxa) ? taxa : null,
      };

      if (editando) {
        await editarDivida(editando.id, { ...dados, status: statusEdicao });
      } else {
        await criarDivida(dados);
      }

      await carregarDividas();
      fecharModal();
      toast.sucesso(editando ? "Dívida atualizada" : "Dívida adicionada");
    } catch (e) {
      // o erro fica também no modal; o toast cobre o feedback global
      setErroModal(
        tratarErro(e, {
          contexto: "salvar dívida",
          mensagemUsuario: "Não foi possível salvar. Tente novamente.",
        })
      );
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!editando) return;
    setExcluindo(true);
    try {
      await excluirDivida(editando.id);
      await carregarDividas();
      fecharModal();
      toast.sucesso("Dívida excluída");
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir dívida",
        mensagemUsuario: "Não foi possível excluir a dívida.",
      });
    } finally {
      setExcluindo(false);
    }
  }

  // ─── Filtragem ─────────────────────────────────────────────────────────────

  const dividasFiltradas = dividas
    .filter((d) => {
      if (filtro === "aberto") return d.status === "ATIVO" || d.status === "VENCIDO";
      if (filtro === "quitadas") return d.status === "PAGO";
      return true;
    })
    .filter((d) =>
      busca.trim() === "" ||
      d.description.toLowerCase().includes(busca.toLowerCase())
    );

  const { totalEmAberto, pagamentoMensal, parcelasAtivas } = computarStats(dividas);
  const temDados = dividas.length > 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-5 bg-surface">
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">em aberto</p>
          <p className="text-[22px] font-bold text-negative tabular-nums mt-1">
            {temDados ? formatarBRL(totalEmAberto) : "R$ —"}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border-subtle">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">pagamento mensal</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {temDados ? formatarBRL(pagamentoMensal) : "R$ —"}
          </p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">parcelas ativas</p>
          <p className="text-[22px] font-bold text-ink tabular-nums mt-1">
            {temDados ? parcelasAtivas : "—"}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 w-60 h-10 px-3.5 bg-surface border border-border rounded-xl">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted shrink-0">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar dívida…"
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-ink placeholder:text-ink-placeholder"
          />
        </div>
        {(["todas", "aberto", "quitadas"] as const).map((f) => {
          const ativo = filtro === f;
          const label = f === "todas" ? "Todas" : f === "aberto" ? "Em aberto" : "Quitadas";
          return (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className="h-9 px-4 rounded-full text-sm font-semibold transition-colors"
              style={{
                border: ativo ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                background: ativo ? "#EAF1FD" : "#fff",
                color: ativo ? "#2F63C9" : "#5B616E",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div
          className="grid px-5 h-10 bg-surface-subtle border-b border-border items-center"
          style={{ gridTemplateColumns: "minmax(0,1fr) 130px 130px 150px 150px 80px" }}
        >
          <span className="text-xs font-semibold text-ink-muted">Dívida</span>
          <span className="text-xs font-semibold text-ink-muted">Tipo</span>
          <span className="text-xs font-semibold text-ink-muted">Vencimento</span>
          <span className="text-xs font-semibold text-ink-muted">Parcelas</span>
          <span className="text-xs font-semibold text-ink-muted text-right">Saldo devedor</span>
          <span />
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
            Carregando…
          </div>
        ) : dividasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-ink-muted">
            {busca || filtro !== "todas"
              ? "Nenhuma dívida encontrada para este filtro."
              : "Nenhuma dívida cadastrada ainda."}
          </div>
        ) : (
          dividasFiltradas.map((d, i) => {
            const saldo = (d.amountCents ?? 0) * (d.dbtRemainingInstallments ?? 0);
            const pago = d.status === "PAGO";
            const restantes = d.dbtRemainingInstallments ?? 0;
            const total = d.dbtTotalInstallments ?? 0;

            return (
              <div key={d.id}>
                <div
                  className="grid px-5 py-[14px] items-center group"
                  style={{ gridTemplateColumns: "minmax(0,1fr) 130px 130px 150px 150px 80px" }}
                >
                  {/* Nome + status badge */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-ink truncate">{d.description}</p>
                      {pago && (
                        <span className="inline-flex items-center h-[18px] px-2 rounded-full bg-[#E2F4EC] text-[#12A06B] text-[11px] font-semibold shrink-0">
                          quitada
                        </span>
                      )}
                    </div>
                    {d.dbtInterestRate ? (
                      <p className="text-[12px] text-ink-muted mt-0.5">{d.dbtInterestRate}% a.m.</p>
                    ) : null}
                  </div>

                  {/* Tipo */}
                  <span className="text-[13px] font-medium text-[#5B616E]">
                    {labelSubtipo(d.dbtSubType)}
                  </span>

                  {/* Vencimento */}
                  <span className="text-[13px] font-medium text-[#5B616E]">
                    {d.dbtInstallmentDay ? `Dia ${d.dbtInstallmentDay}` : "—"}
                  </span>

                  {/* Parcelas restante/total */}
                  <span className="text-[13px] font-medium text-[#5B616E]">
                    {total > 0 ? `${restantes} de ${total}` : "—"}
                  </span>

                  {/* Saldo devedor */}
                  <span
                    className={`text-right text-[14px] font-semibold tabular-nums ${pago ? "text-ink-muted line-through" : "text-negative"}`}
                  >
                    {formatarBRL(pago ? 0 : saldo)}
                  </span>

                  {/* Ações (visíveis ao hover) */}
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => abrirModalEditar(d)}
                      title="Editar"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors"
                    >
                      <IconEditar />
                    </button>
                  </div>
                </div>
                {i < dividasFiltradas.length - 1 && (
                  <div className="h-px bg-[#E3E6EC] mx-5" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal criar / editar */}
      {modalAberto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[80]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={fecharModal}
        >
          <div
            className="w-[520px] bg-surface rounded-3xl shadow-lg animate-slide-up overflow-y-auto"
            style={{ padding: "30px 30px 26px", maxHeight: "calc(100vh - 48px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmandoExclusao ? (
              <ConfirmacaoExclusao
                nome={editando?.description ?? ""}
                excluindo={excluindo}
                onCancelar={() => setConfirmandoExclusao(false)}
                onConfirmar={handleExcluir}
              />
            ) : (
              <FormularioDivida
                modoEdicao={!!editando}
                descricao={descricao}
                setDescricao={setDescricao}
                subtipo={subtipo}
                setSubtipo={setSubtipo}
                parcelaCentavos={parcelaCentavos}
                setParcelaCentavos={setParcelaCentavos}
                totalParcelas={totalParcelas}
                setTotalParcelas={setTotalParcelas}
                parcelasPagas={parcelasPagas}
                setParcelasPagas={setParcelasPagas}
                diaVencimento={diaVencimento}
                setDiaVencimento={setDiaVencimento}
                taxaJuros={taxaJuros}
                setTaxaJuros={setTaxaJuros}
                statusEdicao={statusEdicao}
                setStatusEdicao={setStatusEdicao}
                podeSalvar={podeSalvar}
                salvando={salvando}
                erro={erroModal}
                onFechar={fecharModal}
                onSalvar={handleSalvar}
                onExcluir={() => setConfirmandoExclusao(true)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes do modal ─────────────────────────────────────────────────

interface FormularioDividaProps {
  modoEdicao: boolean;
  descricao: string;
  setDescricao: (v: string) => void;
  subtipo: SubTipo;
  setSubtipo: (v: SubTipo) => void;
  parcelaCentavos: number;
  setParcelaCentavos: (v: number) => void;
  totalParcelas: number;
  setTotalParcelas: (v: number) => void;
  parcelasPagas: number;
  setParcelasPagas: (v: number) => void;
  diaVencimento: number;
  setDiaVencimento: (v: number) => void;
  taxaJuros: string;
  setTaxaJuros: (v: string) => void;
  statusEdicao: "ATIVO" | "PAGO";
  setStatusEdicao: (v: "ATIVO" | "PAGO") => void;
  podeSalvar: boolean;
  salvando: boolean;
  erro: string | null;
  onFechar: () => void;
  onSalvar: () => void;
  onExcluir: () => void;
}

function FormularioDivida({
  modoEdicao,
  descricao,
  setDescricao,
  subtipo,
  setSubtipo,
  parcelaCentavos,
  setParcelaCentavos,
  totalParcelas,
  setTotalParcelas,
  parcelasPagas,
  setParcelasPagas,
  diaVencimento,
  setDiaVencimento,
  taxaJuros,
  setTaxaJuros,
  statusEdicao,
  setStatusEdicao,
  podeSalvar,
  salvando,
  erro,
  onFechar,
  onSalvar,
  onExcluir,
}: FormularioDividaProps) {
  const saldoRestante = parcelaCentavos * Math.max(0, totalParcelas - parcelasPagas);
  const totalDivida = parcelaCentavos * totalParcelas;

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-[22px]">
        <p className="text-[21px] font-bold text-ink tracking-tight">
          {modoEdicao ? "Editar dívida" : "Nova dívida"}
        </p>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
          style={{ background: "#F0F2F6", color: "#5B616E" }}
        >
          <IconFechar />
        </button>
      </div>

      {/* Nome */}
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Nome da dívida</span>
        <span
          className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
          style={{ border: "1px solid #D4D8E0" }}
        >
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Financiamento do carro"
            autoFocus
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
          />
        </span>
      </label>

      {/* Tipo */}
      <p className="text-[13px] font-semibold text-[#5B616E] mb-2.5">Tipo</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {SUBTIPOS.map((s) => {
          const ativo = subtipo === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSubtipo(s.id)}
              className="h-9 px-4 rounded-full font-semibold text-[14px] cursor-pointer transition-colors"
              style={{
                border: ativo ? "1px solid #87BBF8" : "1px solid #E3E6EC",
                background: ativo ? "#EAF1FD" : "#fff",
                color: ativo ? "#2F63C9" : "#5B616E",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Valor da parcela */}
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Valor da parcela</span>
        <MoneyInput centavos={parcelaCentavos} onChange={setParcelaCentavos} />
      </label>

      {/* Total e pagas */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Total de parcelas</span>
          <span
            className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
            style={{ border: "1px solid #D4D8E0" }}
          >
            <input
              type="number"
              min="1"
              max="360"
              value={totalParcelas}
              onChange={(e) => {
                const v = Math.max(1, parseInt(e.target.value) || 1);
                setTotalParcelas(v);
                setParcelasPagas(Math.min(parcelasPagas, v));
              }}
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink [appearance:textfield]"
            />
            <span className="text-[13px] text-[#5B616E] shrink-0">×</span>
          </span>
        </label>
        <label className="block">
          <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Já pagas</span>
          <span
            className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
            style={{ border: "1px solid #D4D8E0" }}
          >
            <input
              type="number"
              min="0"
              max={totalParcelas}
              value={parcelasPagas}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) setParcelasPagas(Math.max(0, Math.min(v, totalParcelas)));
              }}
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink [appearance:textfield]"
            />
            <span className="text-[13px] text-[#5B616E] shrink-0">×</span>
          </span>
        </label>
      </div>

      {/* Dia de vencimento e juros */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <label className="block">
          <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Dia de vencimento</span>
          <span
            className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
            style={{ border: "1px solid #D4D8E0" }}
          >
            <input
              type="number"
              min="1"
              max="31"
              value={diaVencimento}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) setDiaVencimento(Math.max(1, Math.min(v, 31)));
              }}
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink [appearance:textfield]"
            />
          </span>
        </label>
        <label className="block">
          <span className="block text-[13px] font-semibold text-[#5B616E] mb-2">Juros (opcional)</span>
          <span
            className="flex items-center h-[52px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
            style={{ border: "1px solid #D4D8E0" }}
          >
            <input
              type="text"
              inputMode="decimal"
              value={taxaJuros}
              onChange={(e) => setTaxaJuros(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="0,00"
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder [appearance:textfield]"
            />
            <span className="text-[13px] text-[#5B616E] shrink-0">% a.m.</span>
          </span>
        </label>
      </div>

      {/* Toggle quitada (só em edição) */}
      {modoEdicao && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 mb-5"
          style={{ background: "#F7F8FA", border: "1px solid #E3E6EC" }}
        >
          <div>
            <p className="text-[14px] font-semibold text-ink">Dívida quitada</p>
            <p className="text-[12px] font-medium text-[#5B616E] mt-0.5">marque quando terminar de pagar</p>
          </div>
          <button
            role="switch"
            aria-checked={statusEdicao === "PAGO"}
            onClick={() => setStatusEdicao(statusEdicao === "PAGO" ? "ATIVO" : "PAGO")}
            className="relative shrink-0 w-[46px] h-[27px] rounded-full border-none cursor-pointer transition-colors"
            style={{ background: statusEdicao === "PAGO" ? "#12A06B" : "#D4D8E0", padding: 0 }}
          >
            <span
              className="absolute top-[3px] w-[21px] h-[21px] rounded-full bg-white transition-[left] duration-200"
              style={{
                left: statusEdicao === "PAGO" ? "22px" : "3px",
                boxShadow: "0 1px 3px rgba(14,17,22,.25)",
              }}
            />
          </button>
        </div>
      )}

      {/* Resumo */}
      {parcelaCentavos > 0 && totalParcelas >= 1 && (
        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{ background: "#F7F8FA", border: "1px solid #E3E6EC" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#5B616E]">Saldo restante</span>
            <span className="text-[14px] font-semibold text-negative tabular-nums">
              {formatarBRL(saldoRestante)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[13px] text-[#5B616E]">Total da dívida</span>
            <span className="text-[13px] font-medium text-ink tabular-nums">
              {formatarBRL(totalDivida)}
            </span>
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div
          className="rounded-xl px-4 py-3 mb-4 text-[13px] font-medium"
          style={{ background: "#FFF8F8", border: "1px solid #FECACA", color: "#991B1B" }}
        >
          {erro}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2.5">
        {modoEdicao && (
          <button
            onClick={onExcluir}
            title="Excluir dívida"
            className="h-12 w-12 rounded-full flex items-center justify-center text-[#DC2626] hover:bg-red-50 transition-colors shrink-0"
            style={{ border: "1px solid #FECACA" }}
          >
            <IconExcluir />
          </button>
        )}
        <button
          onClick={onFechar}
          className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
          style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
        >
          Cancelar
        </button>
        <button
          onClick={onSalvar}
          disabled={!podeSalvar || salvando}
          className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          style={{ background: "#4078E6", boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)" }}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>
  );
}

interface ConfirmacaoExclusaoProps {
  nome: string;
  excluindo: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

function ConfirmacaoExclusao({ nome, excluindo, onCancelar, onConfirmar }: ConfirmacaoExclusaoProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[21px] font-bold text-ink tracking-tight">Excluir dívida</p>
        <button
          onClick={onCancelar}
          aria-label="Voltar"
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
          style={{ background: "#F0F2F6", color: "#5B616E" }}
        >
          <IconFechar />
        </button>
      </div>
      <div
        className="rounded-2xl p-4 mb-6"
        style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}
      >
        <p className="text-[14px] font-semibold text-[#991B1B]">Isso não pode ser desfeito</p>
        <p className="text-[13px] text-[#7F1D1D] mt-1">
          A dívida <strong>{nome}</strong> e todas as suas parcelas serão removidas permanentemente.
        </p>
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={onCancelar}
          className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
          style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmar}
          disabled={excluindo}
          className="flex-1 h-12 rounded-full border-none text-white font-semibold text-[15px] disabled:opacity-50 transition-opacity"
          style={{ background: "#DC2626" }}
        >
          {excluindo ? "Excluindo…" : "Excluir mesmo assim"}
        </button>
      </div>
    </>
  );
}
