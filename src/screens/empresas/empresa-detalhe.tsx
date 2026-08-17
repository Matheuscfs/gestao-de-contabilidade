/**
 * Detalhe da empresa — abas Dados, Sócios e Funcionários.
 *
 * O botão "Adicionar" do header muda de alvo conforme a aba ativa
 * (novo sócio / novo funcionário).
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  excluirEmpresa,
  obterEmpresa,
  LABEL_REGIME,
  type Empresa,
} from "@/core/db/empresas";
import {
  adicionarSocio,
  editarSocio,
  listarSociosDaEmpresa,
  removerSocio,
  type DadosSocioVinculo,
  type SocioDaEmpresa,
} from "@/core/db/socios";
import {
  criarFuncionario,
  editarFuncionario,
  excluirFuncionario,
  listarFuncionarios,
  LABEL_VINCULO,
  type DadosFuncionario,
  type Funcionario,
  type VinculoFuncionario,
} from "@/core/db/funcionarios";
import {
  listarDesativadas,
  listarOcorrencias,
  prepararObrigacoes,
  type OcorrenciaObrigacao,
} from "@/core/db/obrigacoes";
import { listarProcessos, type Processo } from "@/core/db/processos";
import { listarAcessos, type Acesso } from "@/core/db/acessos";
import { listarContasDaEmpresa, type Conta } from "@/core/db/contas";
import { apenasDigitos, formatarCNPJ, formatarCPF, validarCPF } from "@/utils/documento";
import { formatarBRL } from "@/utils/money";
import { formatarData } from "@/utils/dates";
import { AbaAcessos } from "./aba-acessos";
import { AbaFolha } from "./aba-folha";
import { AbaObrigacoes } from "./aba-obrigacoes";
import { AbaProcessos } from "./aba-processos";
import { AbaReforma } from "./aba-reforma";
import { AbaTributos } from "./aba-tributos";
import { ModalEmpresa } from "./modal-empresa";

type Aba =
  | "dados"
  | "acessos"
  | "socios"
  | "funcionarios"
  | "folha"
  | "obrigacoes"
  | "tributos"
  | "processos"
  | "reforma";

/**
 * Abas que registram o próprio "Adicionar" no header. Os efeitos dos filhos
 * rodam antes do efeito do pai, então zerar o handler aqui apagaria o delas.
 */
const ABAS_COM_HANDLER_PROPRIO = new Set<Aba>(["processos", "acessos"]);

const ESTILO_BORDA = { border: "1px solid #D4D8E0" };

// ─── Blocos de formulário compartilhados no arquivo ───────────────────────────

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

function Toggle({
  ligado,
  onMudar,
  titulo,
  descricao,
}: {
  ligado: boolean;
  onMudar: (v: boolean) => void;
  titulo: string;
  descricao?: string;
}) {
  return (
    <button
      onClick={() => onMudar(!ligado)}
      className="flex items-center justify-between rounded-xl px-4 py-3 w-full"
      style={ESTILO_BORDA}
    >
      <span className="text-left">
        <span className="block text-[14px] font-semibold text-ink">{titulo}</span>
        {descricao && (
          <span className="block text-[12px] text-ink-muted mt-0.5">{descricao}</span>
        )}
      </span>
      <span
        className="shrink-0 w-[42px] h-[24px] rounded-full p-[3px] transition-colors"
        style={{ background: ligado ? "#4078E6" : "#D4D8E0" }}
      >
        <span
          className="block w-[18px] h-[18px] rounded-full bg-white transition-transform"
          style={{ transform: ligado ? "translateX(18px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}

/** Formata centésimos de % para exibição: 5000 → "50%", 3350 → "33,5%". */
function formatarParticipacao(centesimos: number): string {
  return `${(centesimos / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

// ─── Modal de sócio ───────────────────────────────────────────────────────────

function ModalSocio({
  empresaId,
  editando,
  onSalvo,
  onFechar,
}: {
  empresaId: string;
  editando: SocioDaEmpresa | null;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(editando?.nome ?? "");
  const [cpf, setCpf] = useState(editando?.cpf ? formatarCPF(editando.cpf) : "");
  const [email, setEmail] = useState(editando?.email ?? "");
  const [telefone, setTelefone] = useState(editando?.telefone ?? "");
  const [participacao, setParticipacao] = useState(
    editando ? (editando.participacaoCentesimos / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : ""
  );
  const [administrador, setAdministrador] = useState(editando?.isAdministrador ?? false);
  const [proLabore, setProLabore] = useState(editando?.proLaboreCents ?? 0);
  const [distribuicao, setDistribuicao] = useState(editando?.recebeDistribuicao ?? true);
  const [dataEntrada, setDataEntrada] = useState(editando?.dataEntrada ?? "");
  const [dataSaida, setDataSaida] = useState(editando?.dataSaida ?? "");

  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome do sócio.");
      return;
    }
    const cpfDigitos = apenasDigitos(cpf);
    if (cpfDigitos && !validarCPF(cpfDigitos)) {
      setErro("CPF inválido — confira os dígitos.");
      return;
    }
    const participacaoNum = parseFloat(participacao.replace(",", "."));
    const participacaoCentesimos = Number.isFinite(participacaoNum)
      ? Math.round(Math.min(Math.max(participacaoNum, 0), 100) * 100)
      : 0;

    setSalvando(true);
    try {
      const dados: DadosSocioVinculo = {
        nome,
        cpf: cpfDigitos || null,
        email: email || null,
        telefone: telefone || null,
        participacaoCentesimos,
        isAdministrador: administrador,
        proLaboreCents: proLabore,
        recebeDistribuicao: distribuicao,
        dataEntrada: dataEntrada || null,
        dataSaida: dataSaida || null,
      };
      if (editando) {
        await editarSocio(editando.vinculoId, editando.socioId, dados);
        toast.sucesso("Sócio atualizado");
      } else {
        await adicionarSocio(empresaId, dados);
        toast.sucesso("Sócio adicionado");
      }
      onSalvo();
    } catch (e) {
      setErro(
        tratarErro(e, {
          contexto: "salvar sócio",
          mensagemUsuario: "Não foi possível salvar o sócio.",
        })
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!editando) return;
    setRemovendo(true);
    try {
      await removerSocio(editando.vinculoId, editando.socioId);
      toast.sucesso("Sócio removido");
      onSalvo();
    } catch (e) {
      tratarErro(e, {
        contexto: "remover sócio",
        mensagemUsuario: "Não foi possível remover o sócio.",
      });
    } finally {
      setRemovendo(false);
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
        {confirmandoRemocao ? (
          <>
            <p className="text-[21px] font-bold text-ink tracking-tight mb-6">
              Remover sócio
            </p>
            <div
              className="rounded-2xl p-4 mb-6"
              style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}
            >
              <p className="text-[14px] font-semibold text-[#991B1B]">
                Isso não pode ser desfeito
              </p>
              <p className="text-[13px] text-[#7F1D1D] mt-1">
                <strong>{editando?.nome}</strong> será removido do quadro societário
                desta empresa. Se preferir registrar a saída sem apagar o histórico,
                preencha a data de saída.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmandoRemocao(false)}
                className="flex-1 h-12 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
              >
                Cancelar
              </button>
              <button
                onClick={remover}
                disabled={removendo}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50"
                style={{ background: "#D74A45" }}
              >
                {removendo ? "Removendo…" : "Remover mesmo assim"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                {editando ? "Editar sócio" : "Novo sócio"}
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
              <Campo label="Nome">
                <InputTexto
                  valor={nome}
                  onChange={setNome}
                  placeholder="Nome completo"
                  autoFocus={!editando}
                />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="CPF" opcional>
                  <InputTexto
                    valor={cpf}
                    onChange={(v) => setCpf(formatarCPF(v))}
                    placeholder="000.000.000-00"
                  />
                </Campo>
                <Campo label="Participação (%)">
                  <span
                    className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                    style={ESTILO_BORDA}
                  >
                    <input
                      value={participacao}
                      onChange={(e) =>
                        setParticipacao(e.target.value.replace(/[^\d.,]/g, ""))
                      }
                      placeholder="Ex: 50"
                      inputMode="decimal"
                      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium tabular-nums text-ink placeholder:text-ink-placeholder font-sans"
                    />
                    <span className="text-[15px] font-semibold text-ink-muted select-none">%</span>
                  </span>
                </Campo>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="E-mail" opcional>
                  <InputTexto valor={email} onChange={setEmail} placeholder="email@exemplo.com" />
                </Campo>
                <Campo label="Telefone" opcional>
                  <InputTexto valor={telefone} onChange={setTelefone} placeholder="(00) 00000-0000" />
                </Campo>
              </div>

              <Campo label="Pró-labore mensal">
                <MoneyInput
                  centavos={proLabore}
                  onChange={setProLabore}
                  aria-label="Pró-labore mensal"
                />
                <span className="block text-[12px] text-ink-muted mt-1.5">
                  Deixe em branco se o sócio não retira pró-labore. O valor alimenta o
                  Fator R e as obrigações de folha (INSS/IRRF).
                </span>
              </Campo>

              <Toggle
                ligado={administrador}
                onMudar={setAdministrador}
                titulo="Sócio administrador"
                descricao="Responde pela empresa nos atos societários."
              />
              <Toggle
                ligado={distribuicao}
                onMudar={setDistribuicao}
                titulo="Recebe distribuição de lucros"
              />

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Entrada na sociedade" opcional>
                  <InputTexto valor={dataEntrada} onChange={setDataEntrada} tipo="date" />
                </Campo>
                {editando && (
                  <Campo label="Saída da sociedade" opcional>
                    <InputTexto valor={dataSaida} onChange={setDataSaida} tipo="date" />
                  </Campo>
                )}
              </div>
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
              {editando ? (
                <button
                  onClick={() => setConfirmandoRemocao(true)}
                  className="shrink-0 h-12 px-4 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                  style={{ border: "1px solid #F5C5C3", background: "#FEF2F2", color: "#D74A45" }}
                >
                  Remover
                </button>
              ) : (
                <button
                  onClick={onFechar}
                  disabled={salvando}
                  className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                  style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={salvar}
                disabled={!nome.trim() || salvando}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  background: "#4078E6",
                  boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
                  border: "none",
                }}
              >
                {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar sócio"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal de funcionário ─────────────────────────────────────────────────────

const VINCULOS: VinculoFuncionario[] = ["CLT", "ESTAGIO", "APRENDIZ", "TEMPORARIO", "OUTRO"];

function ModalFuncionario({
  empresaId,
  editando,
  onSalvo,
  onFechar,
}: {
  empresaId: string;
  editando: Funcionario | null;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(editando?.nome ?? "");
  const [cpf, setCpf] = useState(editando?.cpf ? formatarCPF(editando.cpf) : "");
  const [cargo, setCargo] = useState(editando?.cargo ?? "");
  const [vinculo, setVinculo] = useState<VinculoFuncionario>(editando?.vinculo ?? "CLT");
  const [salario, setSalario] = useState(editando?.salarioCents ?? 0);
  const [dataAdmissao, setDataAdmissao] = useState(editando?.dataAdmissao ?? "");
  const [dataDemissao, setDataDemissao] = useState(editando?.dataDemissao ?? "");

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome do funcionário.");
      return;
    }
    const cpfDigitos = apenasDigitos(cpf);
    if (cpfDigitos && !validarCPF(cpfDigitos)) {
      setErro("CPF inválido — confira os dígitos.");
      return;
    }
    setSalvando(true);
    try {
      const dados: DadosFuncionario = {
        nome,
        cpf: cpfDigitos || null,
        cargo: cargo || null,
        vinculo,
        salarioCents: salario,
        dataAdmissao: dataAdmissao || null,
        dataDemissao: dataDemissao || null,
      };
      if (editando) {
        await editarFuncionario(editando.id, dados);
        toast.sucesso("Funcionário atualizado");
      } else {
        await criarFuncionario(empresaId, dados);
        toast.sucesso("Funcionário adicionado");
      }
      onSalvo();
    } catch (e) {
      setErro(
        tratarErro(e, {
          contexto: "salvar funcionário",
          mensagemUsuario: "Não foi possível salvar o funcionário.",
        })
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!editando) return;
    setExcluindo(true);
    try {
      await excluirFuncionario(editando.id);
      toast.sucesso("Funcionário excluído");
      onSalvo();
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir funcionário",
        mensagemUsuario: "Não foi possível excluir o funcionário.",
      });
    } finally {
      setExcluindo(false);
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
        {confirmandoExclusao ? (
          <>
            <p className="text-[21px] font-bold text-ink tracking-tight mb-6">
              Excluir funcionário
            </p>
            <div
              className="rounded-2xl p-4 mb-6"
              style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}
            >
              <p className="text-[14px] font-semibold text-[#991B1B]">
                Isso não pode ser desfeito
              </p>
              <p className="text-[13px] text-[#7F1D1D] mt-1">
                <strong>{editando?.nome}</strong> será removido do quadro. Se ele foi
                desligado, prefira preencher a data de demissão para manter o histórico.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmandoExclusao(false)}
                className="flex-1 h-12 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
              >
                Cancelar
              </button>
              <button
                onClick={excluir}
                disabled={excluindo}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50"
                style={{ background: "#D74A45" }}
              >
                {excluindo ? "Excluindo…" : "Excluir mesmo assim"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[21px] font-bold text-ink tracking-tight">
                {editando ? "Editar funcionário" : "Novo funcionário"}
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
              <Campo label="Nome">
                <InputTexto
                  valor={nome}
                  onChange={setNome}
                  placeholder="Nome completo"
                  autoFocus={!editando}
                />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="CPF" opcional>
                  <InputTexto
                    valor={cpf}
                    onChange={(v) => setCpf(formatarCPF(v))}
                    placeholder="000.000.000-00"
                  />
                </Campo>
                <Campo label="Cargo" opcional>
                  <InputTexto valor={cargo} onChange={setCargo} placeholder="Ex: Recepcionista" />
                </Campo>
              </div>

              <div>
                <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">
                  Vínculo
                </p>
                <div className="flex flex-wrap gap-2">
                  {VINCULOS.map((v) => {
                    const ativo = vinculo === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setVinculo(v)}
                        className="h-[36px] px-3.5 rounded-full font-semibold text-[14px] transition-colors"
                        style={
                          ativo
                            ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                            : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                        }
                      >
                        {LABEL_VINCULO[v]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Campo label="Salário mensal">
                <MoneyInput
                  centavos={salario}
                  onChange={setSalario}
                  aria-label="Salário mensal"
                />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Admissão" opcional>
                  <InputTexto valor={dataAdmissao} onChange={setDataAdmissao} tipo="date" />
                </Campo>
                {editando && (
                  <Campo label="Demissão" opcional>
                    <InputTexto valor={dataDemissao} onChange={setDataDemissao} tipo="date" />
                  </Campo>
                )}
              </div>
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
              {editando ? (
                <button
                  onClick={() => setConfirmandoExclusao(true)}
                  className="shrink-0 h-12 px-4 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                  style={{ border: "1px solid #F5C5C3", background: "#FEF2F2", color: "#D74A45" }}
                >
                  Excluir
                </button>
              ) : (
                <button
                  onClick={onFechar}
                  disabled={salvando}
                  className="shrink-0 h-12 px-[22px] rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                  style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={salvar}
                disabled={!nome.trim() || salvando}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  background: "#4078E6",
                  boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
                  border: "none",
                }}
              >
                {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar funcionário"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Aba Dados ────────────────────────────────────────────────────────────────

function LinhaDado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border-subtle last:border-b-0">
      <span className="text-[13px] font-semibold text-ink-secondary shrink-0">
        {rotulo}
      </span>
      <span className="text-[14px] font-medium text-ink text-right truncate">
        {valor || "—"}
      </span>
    </div>
  );
}

/**
 * Contas bancárias que a empresa possui. Só aparece quando há vínculo — é a
 * ponte com o Open Finance, e o vínculo em si se faz na tela de Contas.
 */
function ContasVinculadas({ contas }: { contas: Conta[] }) {
  if (contas.length === 0) return null;

  const total = contas.reduce((soma, c) => soma + c.balanceCents, 0);

  return (
    <div className="bg-surface border rounded-2xl px-5 py-4" style={{ borderColor: "#E3E6EC" }}>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <p className="text-[13px] font-semibold text-ink-secondary">
          Contas bancárias
        </p>
        <p className="text-[15px] font-bold text-ink tabular-nums">
          {formatarBRL(total)}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {contas.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <span className="text-[14px] font-medium text-ink truncate">
              {c.name}
              {c.source === "PLUGGY" && (
                <span
                  className="ml-2 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold align-middle"
                  style={{ background: "#E2F4EC", color: "#0E885A" }}
                >
                  OPEN FINANCE
                </span>
              )}
            </span>
            <span className="text-[14px] font-medium text-ink tabular-nums shrink-0">
              {formatarBRL(c.balanceCents)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AbaDados({
  empresa,
  contas,
  onEditar,
  onExcluida,
}: {
  empresa: Empresa;
  contas: Conta[];
  onEditar: () => void;
  onExcluida: () => void;
}) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      await excluirEmpresa(empresa.id);
      toast.sucesso("Empresa excluída");
      onExcluida();
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir empresa",
        mensagemUsuario: "Não foi possível excluir a empresa.",
      });
      setExcluindo(false);
    }
  }

  const regimeLabel =
    empresa.regimeTributario === "SIMPLES" && empresa.anexoSimples
      ? `${LABEL_REGIME.SIMPLES} · Anexo ${empresa.anexoSimples}`
      : LABEL_REGIME[empresa.regimeTributario];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface border rounded-2xl px-5 py-2" style={{ borderColor: "#E3E6EC" }}>
        <LinhaDado rotulo="Razão social" valor={empresa.razaoSocial} />
        <LinhaDado rotulo="Nome fantasia" valor={empresa.nomeFantasia} />
        <LinhaDado rotulo="CNPJ" valor={formatarCNPJ(empresa.cnpj)} />
        <LinhaDado rotulo="Regime tributário" valor={regimeLabel} />
        <LinhaDado
          rotulo="Data de abertura"
          valor={empresa.dataAbertura ? formatarData(empresa.dataAbertura, true) : null}
        />
        <LinhaDado rotulo="CNAE principal" valor={empresa.cnaePrincipal} />
        <LinhaDado
          rotulo="Município / UF"
          valor={
            empresa.municipio || empresa.uf
              ? [empresa.municipio, empresa.uf].filter(Boolean).join(" / ")
              : null
          }
        />
        <LinhaDado rotulo="Inscrição estadual" valor={empresa.inscricaoEstadual} />
        <LinhaDado rotulo="Inscrição municipal" valor={empresa.inscricaoMunicipal} />
        <LinhaDado rotulo="E-mail" valor={empresa.email} />
        <LinhaDado rotulo="Telefone" valor={empresa.telefone} />
        <LinhaDado
          rotulo="Honorário mensal"
          valor={empresa.honorariosCents > 0 ? formatarBRL(empresa.honorariosCents) : null}
        />
        <LinhaDado
          rotulo="Capital social"
          valor={
            empresa.capitalSocialCents > 0 ? formatarBRL(empresa.capitalSocialCents) : null
          }
        />
        <LinhaDado rotulo="Procuração (e-CAC)" valor={empresa.procuracaoResponsavel} />
        <LinhaDado
          rotulo="Possui funcionários"
          valor={empresa.temFuncionarios ? "Sim" : "Não"}
        />
        <LinhaDado
          rotulo="Movimento"
          valor={empresa.semMovimento ? "Sem movimento (zerada)" : "Com movimento"}
        />
        <LinhaDado rotulo="Observações" valor={empresa.notes} />
      </div>

      <ContasVinculadas contas={contas} />

      <div className="flex gap-2.5">
        <button
          onClick={onEditar}
          className="h-11 px-5 rounded-full font-semibold text-[14px] hover:opacity-80 transition-opacity"
          style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
        >
          Editar dados
        </button>
        <button
          onClick={() => setConfirmandoExclusao(true)}
          className="h-11 px-5 rounded-full font-semibold text-[14px] hover:opacity-80 transition-opacity"
          style={{ border: "1px solid #F5C5C3", background: "#FEF2F2", color: "#D74A45" }}
        >
          Excluir empresa
        </button>
      </div>

      {confirmandoExclusao && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[80]"
          style={{ background: "rgba(14,17,22,.42)" }}
          onClick={() => !excluindo && setConfirmandoExclusao(false)}
        >
          <div
            className="w-[480px] bg-surface rounded-3xl shadow-2xl animate-slide-up"
            style={{ padding: "24px 30px 22px", boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[21px] font-bold text-ink tracking-tight mb-6">
              Excluir empresa
            </p>
            <div
              className="rounded-2xl p-4 mb-6"
              style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}
            >
              <p className="text-[14px] font-semibold text-[#991B1B]">
                Isso não pode ser desfeito
              </p>
              <p className="text-[13px] text-[#7F1D1D] mt-1">
                <strong>{empresa.razaoSocial}</strong> será excluída junto com o
                quadro societário e os funcionários cadastrados nela.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmandoExclusao(false)}
                className="flex-1 h-12 rounded-full font-semibold text-[15px] hover:opacity-80 transition-opacity"
                style={{ border: "1px solid #D4D8E0", background: "#fff", color: "#0E1116" }}
              >
                Cancelar
              </button>
              <button
                onClick={excluir}
                disabled={excluindo}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50"
                style={{ background: "#D74A45" }}
              >
                {excluindo ? "Excluindo…" : "Excluir mesmo assim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function EmpresaDetalheScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setOnAdicionar } = useHeaderActionsStore();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [socios, setSocios] = useState<SocioDaEmpresa[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaObrigacao[]>([]);
  const [desativadas, setDesativadas] = useState<Set<string>>(new Set());
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [contasVinculadas, setContasVinculadas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>("dados");

  const [modalEmpresa, setModalEmpresa] = useState(false);
  const [modalSocio, setModalSocio] = useState(false);
  const [socioEditando, setSocioEditando] = useState<SocioDaEmpresa | null>(null);
  const [modalFuncionario, setModalFuncionario] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState<Funcionario | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const [emp, soc, func] = await Promise.all([
        obterEmpresa(id),
        listarSociosDaEmpresa(id),
        listarFuncionarios(id),
      ]);
      if (!emp) {
        navigate("/empresas", { replace: true });
        return;
      }
      setEmpresa(emp);
      setSocios(soc);
      setFuncionarios(func);
      // Materializa a agenda de obrigações da janela atual e recarrega.
      await prepararObrigacoes(emp);
      const [ocor, desat, proc, aces, cont] = await Promise.all([
        listarOcorrencias(id),
        listarDesativadas(id),
        listarProcessos(id),
        listarAcessos(id),
        listarContasDaEmpresa(id),
      ]);
      setOcorrencias(ocor);
      setDesativadas(desat);
      setProcessos(proc);
      setAcessos(aces);
      setContasVinculadas(cont);
    } catch (e) {
      tratarErro(e, {
        contexto: "carregar empresa",
        mensagemUsuario: "Não foi possível carregar a empresa.",
      });
    } finally {
      setCarregando(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O "Adicionar" do header acompanha a aba ativa.
  useEffect(() => {
    if (aba === "socios") {
      setOnAdicionar(() => {
        setSocioEditando(null);
        setModalSocio(true);
      });
    } else if (aba === "funcionarios") {
      setOnAdicionar(() => {
        setFuncionarioEditando(null);
        setModalFuncionario(true);
      });
    } else if (!ABAS_COM_HANDLER_PROPRIO.has(aba)) {
      setOnAdicionar(null);
    }
    return () => setOnAdicionar(null);
  }, [aba, setOnAdicionar]);

  if (carregando || !empresa) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
        Carregando…
      </div>
    );
  }

  const chipStatus =
    empresa.status === "ATIVA"
      ? { bg: "#E2F4EC", cor: "#0E885A", texto: "ativa" }
      : empresa.status === "INATIVA"
      ? { bg: "#FCF1DF", cor: "#B9791C", texto: "inativa" }
      : { bg: "#F0F2F6", cor: "#5B616E", texto: "baixada" };

  const pendencias = ocorrencias.filter((o) => o.status === "PENDENTE").length;
  const temProLabore = socios.some(
    (s) => s.dataSaida == null && s.proLaboreCents > 0
  );

  const ABAS: { valor: Aba; label: string; badge?: number }[] = [
    { valor: "dados", label: "Dados" },
    { valor: "acessos", label: "Acessos", badge: acessos.length },
    { valor: "socios", label: "Sócios", badge: socios.length },
    { valor: "funcionarios", label: "Funcionários", badge: funcionarios.length },
    { valor: "folha", label: "Folha" },
    { valor: "obrigacoes", label: "Obrigações", badge: pendencias },
    { valor: "tributos", label: "Tributos" },
    {
      valor: "processos",
      label: "Processos",
      badge: processos.filter(
        (p) => p.status === "EM_ANDAMENTO" || p.status === "AGUARDANDO"
      ).length,
    },
    { valor: "reforma", label: "Reforma" },
  ];

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "760px", margin: "0 auto", width: "100%", paddingTop: "6px" }}
    >
      {/* Cabeçalho próprio (a rota de detalhe não tem título fixo no shell) */}
      <div className="flex items-center gap-3 px-0.5">
        <button
          onClick={() => navigate("/empresas")}
          aria-label="Voltar para empresas"
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-ink-secondary hover:text-ink hover:bg-surface-subtle transition-colors shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-[22px] text-ink tracking-[-0.02em] truncate">
              {empresa.nomeFantasia || empresa.razaoSocial}
            </h1>
            <span
              className="shrink-0 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-semibold"
              style={{ background: chipStatus.bg, color: chipStatus.cor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
              {chipStatus.texto}
            </span>
          </div>
          <p className="text-[13px] text-ink-secondary tabular-nums truncate">
            {formatarCNPJ(empresa.cnpj)} ·{" "}
            {empresa.regimeTributario === "SIMPLES" && empresa.anexoSimples
              ? `${LABEL_REGIME.SIMPLES} · Anexo ${empresa.anexoSimples}`
              : LABEL_REGIME[empresa.regimeTributario]}
          </p>
        </div>
      </div>

      {/* Abas */}
      <div
        className="flex gap-1.5 p-1 rounded-full mt-5 mb-5 w-fit"
        style={{ background: "#F0F2F6" }}
      >
        {ABAS.map((a) => {
          const ativa = aba === a.valor;
          return (
            <button
              key={a.valor}
              onClick={() => setAba(a.valor)}
              className="h-[38px] px-4 rounded-full font-semibold text-[14px] transition-all inline-flex items-center gap-1.5"
              style={
                ativa
                  ? { background: "#fff", color: "#0E1116", boxShadow: "0 1px 2px rgba(14,17,22,.10)" }
                  : { background: "transparent", color: "#5B616E" }
              }
            >
              {a.label}
              {a.badge != null && a.badge > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11.5px] font-bold"
                  style={{ background: ativa ? "#EAF1FD" : "#E3E6EC", color: ativa ? "#2F63C9" : "#5B616E" }}
                >
                  {a.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da aba */}
      {aba === "dados" && (
        <AbaDados
          empresa={empresa}
          contas={contasVinculadas}
          onEditar={() => setModalEmpresa(true)}
          onExcluida={() => navigate("/empresas", { replace: true })}
        />
      )}

      {aba === "acessos" && id && (
        <AbaAcessos empresaId={id} acessos={acessos} onRecarregar={carregar} />
      )}

      {aba === "folha" && (
        <AbaFolha empresa={empresa} onRecarregar={carregar} />
      )}

      {aba === "obrigacoes" && (
        <AbaObrigacoes
          empresa={empresa}
          temProLabore={temProLabore}
          ocorrencias={ocorrencias}
          desativadas={desativadas}
          onRecarregar={carregar}
        />
      )}

      {aba === "tributos" && (
        <AbaTributos
          empresa={empresa}
          socios={socios}
          funcionarios={funcionarios}
          onRecarregar={carregar}
        />
      )}

      {aba === "processos" && id && (
        <AbaProcessos
          empresaId={id}
          processos={processos}
          onRecarregar={carregar}
        />
      )}

      {aba === "reforma" && (
        <AbaReforma empresa={empresa} onRecarregar={carregar} />
      )}

      {aba === "socios" && (
        <div className="flex flex-col gap-2.5">
          {socios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <p className="text-sm font-medium text-ink-muted">
                Nenhum sócio cadastrado nesta empresa.
              </p>
              <button
                onClick={() => {
                  setSocioEditando(null);
                  setModalSocio(true);
                }}
                className="mt-1 text-sm font-semibold text-brand hover:underline"
              >
                Adicionar o primeiro
              </button>
            </div>
          ) : (
            socios.map((s) => {
              const saiu = s.dataSaida != null;
              return (
                <button
                  key={s.vinculoId}
                  onClick={() => {
                    setSocioEditando(s);
                    setModalSocio(true);
                  }}
                  className="bg-surface border rounded-2xl px-5 py-4 flex items-center gap-4 text-left hover:border-brand/40 transition-all"
                  style={{ borderColor: "#E3E6EC", opacity: saiu ? 0.55 : 1 }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[17px] shrink-0"
                    style={{ background: "#EAF1FD", color: "#2F63C9" }}
                  >
                    {s.nome.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[15px] text-ink truncate">{s.nome}</p>
                      {s.isAdministrador && (
                        <span
                          className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
                          style={{ background: "#EAF1FD", color: "#2F63C9" }}
                        >
                          ADMIN
                        </span>
                      )}
                      {saiu && (
                        <span
                          className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
                          style={{ background: "#F0F2F6", color: "#5B616E" }}
                        >
                          SAIU
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-ink-secondary tabular-nums truncate mt-0.5">
                      {s.cpf ? formatarCPF(s.cpf) : "CPF não informado"}
                      {" · "}
                      {formatarParticipacao(s.participacaoCentesimos)} de participação
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {s.proLaboreCents > 0 ? (
                      <>
                        <p className="font-bold text-[15px] text-ink tabular-nums">
                          {formatarBRL(s.proLaboreCents)}
                        </p>
                        <p className="text-[11.5px] text-ink-muted">pró-labore/mês</p>
                      </>
                    ) : (
                      <p className="text-[12.5px] text-ink-muted">sem pró-labore</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {aba === "funcionarios" && (
        <div className="flex flex-col gap-2.5">
          {funcionarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <p className="text-sm font-medium text-ink-muted">
                Nenhum funcionário cadastrado nesta empresa.
              </p>
              {empresa.temFuncionarios && (
                <p className="text-[12.5px] text-ink-muted max-w-[380px] text-center">
                  A empresa está marcada como tendo funcionários — o cadastro
                  individual é opcional, mas ajuda no cálculo da folha.
                </p>
              )}
              <button
                onClick={() => {
                  setFuncionarioEditando(null);
                  setModalFuncionario(true);
                }}
                className="mt-1 text-sm font-semibold text-brand hover:underline"
              >
                Adicionar o primeiro
              </button>
            </div>
          ) : (
            funcionarios.map((f) => {
              const desligado = f.dataDemissao != null;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setFuncionarioEditando(f);
                    setModalFuncionario(true);
                  }}
                  className="bg-surface border rounded-2xl px-5 py-4 flex items-center gap-4 text-left hover:border-brand/40 transition-all"
                  style={{ borderColor: "#E3E6EC", opacity: desligado ? 0.55 : 1 }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[17px] shrink-0"
                    style={{ background: "#E2F4EC", color: "#0E885A" }}
                  >
                    {f.nome.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[15px] text-ink truncate">{f.nome}</p>
                      <span
                        className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
                        style={{ background: "#F0F2F6", color: "#5B616E" }}
                      >
                        {LABEL_VINCULO[f.vinculo]}
                      </span>
                      {desligado && (
                        <span
                          className="shrink-0 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-bold"
                          style={{ background: "#FBE9E7", color: "#C0413B" }}
                        >
                          DESLIGADO
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-ink-secondary truncate mt-0.5">
                      {f.cargo || "Cargo não informado"}
                      {f.dataAdmissao &&
                        ` · desde ${formatarData(f.dataAdmissao, true)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {f.salarioCents > 0 ? (
                      <>
                        <p className="font-bold text-[15px] text-ink tabular-nums">
                          {formatarBRL(f.salarioCents)}
                        </p>
                        <p className="text-[11.5px] text-ink-muted">salário/mês</p>
                      </>
                    ) : (
                      <p className="text-[12.5px] text-ink-muted">sem salário informado</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Modais */}
      {modalEmpresa && (
        <ModalEmpresa
          editando={empresa}
          onSalvo={() => {
            setModalEmpresa(false);
            carregar();
          }}
          onFechar={() => setModalEmpresa(false)}
        />
      )}
      {modalSocio && id && (
        <ModalSocio
          empresaId={id}
          editando={socioEditando}
          onSalvo={() => {
            setModalSocio(false);
            setSocioEditando(null);
            carregar();
          }}
          onFechar={() => {
            setModalSocio(false);
            setSocioEditando(null);
          }}
        />
      )}
      {modalFuncionario && id && (
        <ModalFuncionario
          empresaId={id}
          editando={funcionarioEditando}
          onSalvo={() => {
            setModalFuncionario(false);
            setFuncionarioEditando(null);
            carregar();
          }}
          onFechar={() => {
            setModalFuncionario(false);
            setFuncionarioEditando(null);
          }}
        />
      )}
    </div>
  );
}
