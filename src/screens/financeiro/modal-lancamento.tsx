/**
 * Modal de lançamento manual do financeiro do escritório.
 *
 * Serve às duas direções: a receber (cobrança de cliente) e a pagar (despesa
 * da casa). O que muda entre elas é o rótulo, as categorias e o fato de que
 * "a receber" costuma ter empresa vinculada — a despesa do escritório não tem
 * cliente nenhum.
 */

import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { tratarErro } from "@/core/errors";
import {
  CATEGORIAS_POR_DIRECAO,
  LABEL_CATEGORIA,
  vencimentoDaCompetencia,
  type CategoriaLancamento,
  type DirecaoLancamento,
} from "@/consts/financeiro";
import {
  criarLancamento,
  editarLancamento,
  type Lancamento,
} from "@/core/db/financeiro";
import type { EmpresaComTotais } from "@/core/db/empresas";

const ESTILO_BORDA = { border: "1px solid #D4D8E0" };

function Campo({
  label,
  opcional,
  children,
}: {
  label: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[13px] font-semibold text-ink-secondary mb-1.5">
        {label}{" "}
        {opcional && <span className="font-normal text-ink-muted">(opcional)</span>}
      </span>
      {children}
    </label>
  );
}

function InputTexto({
  valor,
  onChange,
  placeholder,
  autoFocus,
  tipo = "text",
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  tipo?: "text" | "date";
}) {
  return (
    <span
      className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
      style={ESTILO_BORDA}
    >
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
      />
    </span>
  );
}

export function ModalLancamento({
  editando,
  direcaoInicial,
  competencia,
  empresas,
  onSalvo,
  onFechar,
}: {
  editando: Lancamento | null;
  direcaoInicial: DirecaoLancamento;
  /** AAAA-MM da competência aberta na tela. */
  competencia: string;
  empresas: EmpresaComTotais[];
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [direcao, setDirecao] = useState<DirecaoLancamento>(
    editando?.direcao ?? direcaoInicial
  );
  const [empresaId, setEmpresaId] = useState<string>(editando?.empresaId ?? "");
  const [contraparte, setContraparte] = useState(editando?.contraparte ?? "");
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [categoria, setCategoria] = useState<CategoriaLancamento>(
    editando?.categoria ?? (direcaoInicial === "RECEBER" ? "HONORARIO" : "DESPESA")
  );
  const [valorCents, setValorCents] = useState(editando?.valorCents ?? 0);
  const [vencimento, setVencimento] = useState(
    editando?.vencimento ?? vencimentoDaCompetencia(competencia, 10)
  );
  const [notes, setNotes] = useState(editando?.notes ?? "");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categorias = CATEGORIAS_POR_DIRECAO[direcao];

  /**
   * Escolher a empresa preenche a contraparte e, quando existe honorário
   * cadastrado, já traz o valor e o dia de vencimento do contrato. É o caminho
   * de 90% dos lançamentos a receber.
   */
  function escolherEmpresa(id: string) {
    setEmpresaId(id);
    const e = empresas.find((x) => x.id === id);
    if (!e) return;
    setContraparte(e.razaoSocial);
    if (direcao === "RECEBER" && categoria === "HONORARIO") {
      if (e.honorariosCents > 0 && valorCents === 0) setValorCents(e.honorariosCents);
      setVencimento(vencimentoDaCompetencia(competencia, e.honorarioDiaVencimento));
      if (!descricao.trim()) setDescricao(`Honorário ${competencia}`);
    }
  }

  function trocarDirecao(nova: DirecaoLancamento) {
    setDirecao(nova);
    if (!CATEGORIAS_POR_DIRECAO[nova].includes(categoria)) {
      setCategoria(CATEGORIAS_POR_DIRECAO[nova][0]);
    }
    if (nova === "PAGAR") setEmpresaId("");
  }

  async function salvar() {
    setErro(null);
    if (!contraparte.trim()) {
      setErro(direcao === "RECEBER" ? "Informe o cliente." : "Informe o fornecedor.");
      return;
    }
    if (!descricao.trim()) {
      setErro("Descreva o lançamento.");
      return;
    }
    if (valorCents <= 0) {
      setErro("O valor precisa ser maior que zero.");
      return;
    }
    if (!vencimento) {
      setErro("Informe o vencimento.");
      return;
    }

    setSalvando(true);
    try {
      const dados = {
        direcao,
        empresaId: empresaId || null,
        contraparte,
        descricao,
        categoria,
        competencia,
        valorCents,
        vencimento,
        notes: notes || null,
      };
      if (editando) {
        await editarLancamento(editando.id, dados);
      } else {
        await criarLancamento(dados);
      }
      onSalvo();
    } catch (e) {
      // A trava de honorário único por cliente/competência chega como erro de
      // constraint do SQLite; traduzir dá ao usuário a ação seguinte (editar o
      // lançamento que já existe) em vez de um texto de banco de dados.
      const duplicado = String(e).toLowerCase().includes("unique");
      setErro(
        tratarErro(e, {
          contexto: "salvar lançamento",
          mensagemUsuario: duplicado
            ? "Este cliente já tem honorário lançado nesta competência — edite o lançamento existente."
            : "Não foi possível salvar o lançamento.",
        })
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[80]"
      style={{ background: "rgba(14,17,22,.42)" }}
      onClick={() => !salvando && onFechar()}
    >
      <div
        className="w-[520px] max-h-[88vh] overflow-y-auto bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{ padding: "24px 30px 22px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="text-[21px] font-bold text-ink tracking-tight">
            {editando ? "Editar lançamento" : "Novo lançamento"}
          </p>
          <button
            onClick={onFechar}
            disabled={salvando}
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ background: "#F0F2F6", color: "#5B616E" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Direção */}
          <div className="flex gap-2">
            {(["RECEBER", "PAGAR"] as DirecaoLancamento[]).map((d) => {
              const ativo = direcao === d;
              return (
                <button
                  key={d}
                  onClick={() => trocarDirecao(d)}
                  className="flex-1 h-[38px] rounded-full font-semibold text-[14px] transition-colors"
                  style={
                    ativo
                      ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                      : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                  }
                >
                  {d === "RECEBER" ? "A receber" : "A pagar"}
                </button>
              );
            })}
          </div>

          {direcao === "RECEBER" && (
            <Campo label="Cliente">
              <span
                className="flex items-center h-[46px] px-3 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={ESTILO_BORDA}
              >
                <select
                  value={empresaId}
                  onChange={(e) => escolherEmpresa(e.target.value)}
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink font-sans"
                >
                  <option value="">— escolher —</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razaoSocial}
                    </option>
                  ))}
                </select>
              </span>
            </Campo>
          )}

          <Campo label={direcao === "RECEBER" ? "Nome na cobrança" : "Fornecedor"}>
            <InputTexto
              valor={contraparte}
              onChange={setContraparte}
              placeholder={direcao === "RECEBER" ? "Cliente" : "Ex: Imobiliária, Contmatic"}
              autoFocus={direcao === "PAGAR"}
            />
          </Campo>

          <Campo label="Descrição">
            <InputTexto
              valor={descricao}
              onChange={setDescricao}
              placeholder={
                direcao === "RECEBER" ? "Ex: Honorário 2026-08" : "Ex: Aluguel da sala"
              }
            />
          </Campo>

          <div>
            <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">
              Categoria
            </p>
            <div className="flex flex-wrap gap-2">
              {categorias.map((c) => {
                const ativo = categoria === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCategoria(c)}
                    className="h-[34px] px-3.5 rounded-full font-semibold text-[13px] transition-colors"
                    style={
                      ativo
                        ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                        : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                    }
                  >
                    {LABEL_CATEGORIA[c]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor">
              <MoneyInput centavos={valorCents} onChange={setValorCents} aria-label="Valor" />
            </Campo>
            <Campo label="Vencimento">
              <InputTexto valor={vencimento} onChange={setVencimento} tipo="date" />
            </Campo>
          </div>

          <Campo label="Observações" opcional>
            <InputTexto valor={notes} onChange={setNotes} placeholder="Ex: combinado por WhatsApp" />
          </Campo>
        </div>

        {erro && (
          <div
            className="rounded-xl px-4 py-3 mt-4 text-[13px] font-medium"
            style={{ background: "#FBE9E7", color: "#9B1C1C", border: "1px solid #FCA5A5" }}
          >
            {erro}
          </div>
        )}

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
            style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{
              background: "#4078E6",
              boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
              border: "none",
            }}
          >
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
