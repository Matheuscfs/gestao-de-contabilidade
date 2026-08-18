/**
 * Modal de criação/edição de empresa — compartilhado pela listagem (criar)
 * e pelo detalhe (editar dados).
 */

import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  cnpjJaCadastrado,
  criarEmpresa,
  editarEmpresa,
  LABEL_REGIME,
  type AnexoSimples,
  type DadosEmpresa,
  type Empresa,
  type RegimeTributario,
  type StatusEmpresa,
} from "@/core/db/empresas";
import { apenasDigitos, formatarCNPJ, validarCNPJ } from "@/utils/documento";

const REGIMES: RegimeTributario[] = ["MEI", "SIMPLES", "PRESUMIDO", "REAL"];
const ANEXOS: AnexoSimples[] = ["I", "II", "III", "IV", "V"];
const STATUS: { valor: StatusEmpresa; label: string }[] = [
  { valor: "ATIVA", label: "Ativa" },
  { valor: "INATIVA", label: "Inativa" },
  { valor: "BAIXADA", label: "Baixada" },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// ─── Blocos de formulário reutilizados no arquivo ─────────────────────────────

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

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ModalEmpresa({
  editando,
  onSalvo,
  onFechar,
}: {
  editando: Empresa | null;
  /** Recebe o id da empresa criada/editada. */
  onSalvo: (id: string) => void;
  onFechar: () => void;
}) {
  const [razaoSocial, setRazaoSocial] = useState(editando?.razaoSocial ?? "");
  const [nomeFantasia, setNomeFantasia] = useState(editando?.nomeFantasia ?? "");
  const [cnpj, setCnpj] = useState(editando ? formatarCNPJ(editando.cnpj) : "");
  const [regime, setRegime] = useState<RegimeTributario>(
    editando?.regimeTributario ?? "SIMPLES"
  );
  const [anexo, setAnexo] = useState<AnexoSimples | null>(
    editando?.anexoSimples ?? null
  );
  const [dataAbertura, setDataAbertura] = useState(editando?.dataAbertura ?? "");
  const [cnae, setCnae] = useState(editando?.cnaePrincipal ?? "");
  const [uf, setUf] = useState(editando?.uf ?? "");
  const [municipio, setMunicipio] = useState(editando?.municipio ?? "");
  const [ie, setIe] = useState(editando?.inscricaoEstadual ?? "");
  const [im, setIm] = useState(editando?.inscricaoMunicipal ?? "");
  const [status, setStatus] = useState<StatusEmpresa>(editando?.status ?? "ATIVA");
  const [temFuncionarios, setTemFuncionarios] = useState(
    editando?.temFuncionarios ?? false
  );
  const [email, setEmail] = useState(editando?.email ?? "");
  const [telefone, setTelefone] = useState(editando?.telefone ?? "");
  const [honorarios, setHonorarios] = useState(editando?.honorariosCents ?? 0);
  const [capitalSocial, setCapitalSocial] = useState(
    editando?.capitalSocialCents ?? 0
  );
  const [procuracao, setProcuracao] = useState(
    editando?.procuracaoResponsavel ?? ""
  );
  const [semMovimento, setSemMovimento] = useState(
    editando?.semMovimento ?? false
  );
  const [notes, setNotes] = useState(editando?.notes ?? "");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!razaoSocial.trim()) {
      setErro("Informe a razão social.");
      return;
    }
    const cnpjDigitos = apenasDigitos(cnpj);
    if (!validarCNPJ(cnpjDigitos)) {
      setErro("CNPJ inválido — confira os dígitos.");
      return;
    }
    if (regime === "SIMPLES" && !anexo) {
      setErro("Selecione o anexo do Simples Nacional.");
      return;
    }
    setSalvando(true);
    try {
      if (await cnpjJaCadastrado(cnpjDigitos, editando?.id)) {
        setErro("Já existe uma empresa cadastrada com este CNPJ.");
        return;
      }
      const dados: DadosEmpresa = {
        razaoSocial,
        nomeFantasia: nomeFantasia || null,
        cnpj: cnpjDigitos,
        inscricaoEstadual: ie || null,
        inscricaoMunicipal: im || null,
        dataAbertura: dataAbertura || null,
        cnaePrincipal: cnae || null,
        uf: uf || null,
        municipio: municipio || null,
        regimeTributario: regime,
        anexoSimples: anexo,
        regimeIbsCbs: editando?.regimeIbsCbs ?? null,
        status,
        temFuncionarios,
        email: email || null,
        telefone: telefone || null,
        honorariosCents: honorarios,
        capitalSocialCents: capitalSocial,
        procuracaoResponsavel: procuracao || null,
        semMovimento,
        notes: notes || null,
      };
      let id = editando?.id;
      if (editando) {
        await editarEmpresa(editando.id, dados);
        toast.sucesso("Empresa atualizada");
      } else {
        id = await criarEmpresa(dados);
        toast.sucesso("Empresa adicionada");
      }
      onSalvo(id!);
    } catch (e) {
      setErro(
        tratarErro(e, {
          contexto: "salvar empresa",
          mensagemUsuario: "Não foi possível salvar a empresa.",
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
        className="w-[560px] max-h-[88vh] overflow-y-auto bg-surface rounded-3xl shadow-2xl animate-slide-up"
        style={{
          padding: "24px 30px 22px",
          boxShadow: "0 24px 60px -20px rgba(14,17,22,.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[21px] font-bold text-ink tracking-tight">
            {editando ? "Editar empresa" : "Nova empresa"}
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

        {/* Identificação */}
        <div className="flex flex-col gap-4">
          <Campo label="Razão social">
            <InputTexto
              valor={razaoSocial}
              onChange={setRazaoSocial}
              placeholder="Ex: Aura Serviços Médicos Ltda"
              autoFocus={!editando}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome fantasia" opcional>
              <InputTexto
                valor={nomeFantasia}
                onChange={setNomeFantasia}
                placeholder="Como é conhecida"
              />
            </Campo>
            <Campo label="CNPJ">
              <InputTexto
                valor={cnpj}
                onChange={(v) => setCnpj(formatarCNPJ(v))}
                placeholder="00.000.000/0000-00"
              />
            </Campo>
          </div>

          {/* Regime tributário */}
          <div>
            <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">
              Regime tributário
            </p>
            <div className="flex flex-wrap gap-2">
              {REGIMES.map((r) => {
                const ativo = regime === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRegime(r)}
                    className="h-[36px] px-3.5 rounded-full font-semibold text-[14px] transition-colors"
                    style={
                      ativo
                        ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                        : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                    }
                  >
                    {LABEL_REGIME[r]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Anexo do Simples */}
          {regime === "SIMPLES" && (
            <div>
              <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">
                Anexo do Simples Nacional
              </p>
              <div className="flex gap-2">
                {ANEXOS.map((a) => {
                  const ativo = anexo === a;
                  return (
                    <button
                      key={a}
                      onClick={() => setAnexo(a)}
                      className="w-[52px] h-[36px] rounded-full font-semibold text-[14px] transition-colors"
                      style={
                        ativo
                          ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                          : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                      }
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] text-ink-muted mt-1.5">
                Serviços costumam cair no III ou V (o Fator R decide); comércio no I; indústria no II.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Data de abertura" opcional>
              <InputTexto valor={dataAbertura} onChange={setDataAbertura} tipo="date" />
            </Campo>
            <Campo label="CNAE principal" opcional>
              <InputTexto valor={cnae} onChange={setCnae} placeholder="Ex: 8630-5/03" />
            </Campo>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Campo label="UF" opcional>
              <span
                className="flex items-center h-[46px] px-3 bg-surface rounded-xl focus-within:border-brand transition-colors"
                style={ESTILO_BORDA}
              >
                <select
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink font-sans"
                >
                  <option value="">—</option>
                  {UFS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </span>
            </Campo>
            <Campo label="Município" opcional>
              <InputTexto valor={municipio} onChange={setMunicipio} placeholder="Ex: Goiânia" />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Inscrição estadual" opcional>
              <InputTexto valor={ie} onChange={setIe} placeholder="IE" />
            </Campo>
            <Campo label="Inscrição municipal" opcional>
              <InputTexto valor={im} onChange={setIm} placeholder="IM" />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="E-mail" opcional>
              <InputTexto valor={email} onChange={setEmail} placeholder="contato@empresa.com" />
            </Campo>
            <Campo label="Telefone" opcional>
              <InputTexto valor={telefone} onChange={setTelefone} placeholder="(00) 00000-0000" />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Honorário mensal" opcional>
              <MoneyInput
                centavos={honorarios}
                onChange={setHonorarios}
                aria-label="Honorário mensal"
              />
            </Campo>
            <Campo label="Capital social" opcional>
              <MoneyInput
                centavos={capitalSocial}
                onChange={setCapitalSocial}
                aria-label="Capital social"
              />
            </Campo>
          </div>

          <Campo label="Procuração eletrônica (e-CAC)" opcional>
            <InputTexto
              valor={procuracao}
              onChange={setProcuracao}
              placeholder="Quem responde pela empresa no e-CAC"
            />
          </Campo>

          {/* Status (só na edição — empresa nova nasce ativa) */}
          {editando && (
            <div>
              <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">
                Situação
              </p>
              <div className="flex gap-2">
                {STATUS.map((s) => {
                  const ativo = status === s.valor;
                  return (
                    <button
                      key={s.valor}
                      onClick={() => setStatus(s.valor)}
                      className="h-[36px] px-3.5 rounded-full font-semibold text-[14px] transition-colors"
                      style={
                        ativo
                          ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                          : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tem funcionários */}
          <button
            onClick={() => setTemFuncionarios(!temFuncionarios)}
            className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
            style={ESTILO_BORDA}
          >
            <span className="text-left">
              <span className="block text-[14px] font-semibold text-ink">
                Possui funcionários
              </span>
              <span className="block text-[12px] text-ink-muted mt-0.5">
                Liga as obrigações de folha (eSocial, FGTS Digital) na agenda da empresa.
              </span>
            </span>
            <span
              className="shrink-0 w-[42px] h-[24px] rounded-full p-[3px] transition-colors"
              style={{ background: temFuncionarios ? "#4078E6" : "#D4D8E0" }}
            >
              <span
                className="block w-[18px] h-[18px] rounded-full bg-white transition-transform"
                style={{
                  transform: temFuncionarios ? "translateX(18px)" : "translateX(0)",
                }}
              />
            </span>
          </button>

          {/* Sem movimento no período ("zerada") */}
          <button
            onClick={() => setSemMovimento(!semMovimento)}
            className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
            style={ESTILO_BORDA}
          >
            <span className="text-left">
              <span className="block text-[14px] font-semibold text-ink">
                Sem movimento
              </span>
              <span className="block text-[12px] text-ink-muted mt-0.5">
                Empresa ativa que não fatura no período — segue entregando as
                obrigações, só que zeradas.
              </span>
            </span>
            <span
              className="shrink-0 w-[42px] h-[24px] rounded-full p-[3px] transition-colors"
              style={{ background: semMovimento ? "#4078E6" : "#D4D8E0" }}
            >
              <span
                className="block w-[18px] h-[18px] rounded-full bg-white transition-transform"
                style={{
                  transform: semMovimento ? "translateX(18px)" : "translateX(0)",
                }}
              />
            </span>
          </button>

          <Campo label="Observações" opcional>
            <InputTexto
              valor={notes}
              onChange={setNotes}
              placeholder="Ex: certificado digital vence em outubro"
            />
          </Campo>
        </div>

        {/* Erro */}
        {erro && (
          <div
            className="rounded-xl px-4 py-3 mt-4 text-[13px] font-medium"
            style={{ background: "#FBE9E7", color: "#9B1C1C", border: "1px solid #FCA5A5" }}
          >
            {erro}
          </div>
        )}

        {/* Ações */}
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
            disabled={!razaoSocial.trim() || salvando}
            className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{
              background: "#4078E6",
              boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
              border: "none",
            }}
          >
            {salvando
              ? "Salvando…"
              : editando
              ? "Salvar alterações"
              : "Adicionar empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}
