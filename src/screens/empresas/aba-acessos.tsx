/**
 * Aba Acessos — credenciais dos portais da empresa (NFS-e do município,
 * gov.br, código do Simples, e-CAC, Junta, Bombeiros).
 *
 * É a tela que substitui a planilha aberta o dia inteiro: o gesto principal é
 * copiar usuário/senha e abrir o portal. A senha nasce mascarada e revelar é
 * explícito — ninguém precisa da senha à mostra durante uma chamada de vídeo.
 */

import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { useHeaderActionsStore } from "@/app/header-actions-store";
import { toast } from "@/components/toast";
import { tratarErro } from "@/core/errors";
import {
  criarAcesso,
  editarAcesso,
  excluirAcesso,
  LABEL_TIPO_ACESSO,
  TIPOS_ACESSO,
  type Acesso,
  type DadosAcesso,
  type TipoAcesso,
} from "@/core/db/acessos";

const ESTILO_BORDA = { border: "1px solid #D4D8E0" };

/** Cada tipo tem sua cor para o olho achar o portal certo na lista. */
const CHIP_TIPO: Record<TipoAcesso, { bg: string; cor: string }> = {
  NFSE: { bg: "#EAF1FD", cor: "#2F63C9" },
  PREFEITURA: { bg: "#EAF1FD", cor: "#2F63C9" },
  GOV_BR: { bg: "#E2F4EC", cor: "#0E885A" },
  SIMPLES_NACIONAL: { bg: "#FCF1DF", cor: "#B9791C" },
  ECAC: { bg: "#FCF1DF", cor: "#B9791C" },
  ESTADUAL: { bg: "#F3EEFB", cor: "#6D4AA8" },
  JUNTA: { bg: "#F3EEFB", cor: "#6D4AA8" },
  BOMBEIROS: { bg: "#FBE9E7", cor: "#C0413B" },
  BANCO: { bg: "#F0F2F6", cor: "#5B616E" },
  OUTRO: { bg: "#F0F2F6", cor: "#5B616E" },
};

async function copiar(texto: string, rotulo: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast.sucesso(`${rotulo} copiado`);
  } catch (e) {
    tratarErro(e, {
      contexto: "copiar para a área de transferência",
      mensagemUsuario: "Não foi possível copiar.",
    });
  }
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IconeCopiar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function IconeOlho({ aberto }: { aberto: boolean }) {
  return aberto ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconeAbrir() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

// ─── Blocos ───────────────────────────────────────────────────────────────────

function BotaoIcone({
  onClick,
  titulo,
  children,
}: {
  onClick: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center text-ink-secondary hover:text-ink hover:bg-surface-subtle transition-colors"
    >
      {children}
    </button>
  );
}

/** Linha usuário/senha: valor monoespaçado + copiar (+ revelar, na senha). */
function LinhaCredencial({
  rotulo,
  valor,
  secreta,
}: {
  rotulo: string;
  valor: string;
  secreta?: boolean;
}) {
  const [revelada, setRevelada] = useState(false);
  const oculta = secreta && !revelada;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[12px] font-semibold text-ink-muted w-[52px] shrink-0">
        {rotulo}
      </span>
      <span
        className="flex-1 min-w-0 text-[13px] font-medium text-ink truncate"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {oculta ? "•".repeat(Math.min(valor.length, 14)) : valor}
      </span>
      {secreta && (
        <BotaoIcone
          onClick={() => setRevelada((v) => !v)}
          titulo={revelada ? "Ocultar senha" : "Revelar senha"}
        >
          <IconeOlho aberto={revelada} />
        </BotaoIcone>
      )}
      <BotaoIcone onClick={() => copiar(valor, rotulo)} titulo={`Copiar ${rotulo.toLowerCase()}`}>
        <IconeCopiar />
      </BotaoIcone>
    </div>
  );
}

// ─── Modal criar/editar acesso ────────────────────────────────────────────────

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
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <span
      className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
      style={ESTILO_BORDA}
    >
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
      />
    </span>
  );
}

function ModalAcesso({
  empresaId,
  editando,
  onSalvo,
  onFechar,
}: {
  empresaId: string;
  editando: Acesso | null;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoAcesso>(editando?.tipo ?? "NFSE");
  const [rotulo, setRotulo] = useState(editando?.rotulo ?? "");
  const [usuario, setUsuario] = useState(editando?.usuario ?? "");
  const [senha, setSenha] = useState(editando?.senha ?? "");
  const [link, setLink] = useState(editando?.link ?? "");
  const [notes, setNotes] = useState(editando?.notes ?? "");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (!usuario.trim() && !senha && !link.trim()) {
      setErro("Preencha ao menos usuário, senha ou link.");
      return;
    }
    setSalvando(true);
    try {
      const dados: DadosAcesso = {
        tipo,
        rotulo: rotulo || null,
        usuario: usuario || null,
        senha: senha || null,
        link: link || null,
        notes: notes || null,
      };
      if (editando) {
        await editarAcesso(editando.id, dados);
        toast.sucesso("Acesso atualizado");
      } else {
        await criarAcesso(empresaId, dados);
        toast.sucesso("Acesso adicionado");
      }
      onSalvo();
    } catch (e) {
      setErro(
        tratarErro(e, {
          contexto: "salvar acesso",
          mensagemUsuario: "Não foi possível salvar o acesso.",
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
      await excluirAcesso(editando.id);
      toast.sucesso("Acesso excluído");
      onSalvo();
    } catch (e) {
      tratarErro(e, {
        contexto: "excluir acesso",
        mensagemUsuario: "Não foi possível excluir o acesso.",
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
              Excluir acesso
            </p>
            <div
              className="rounded-2xl p-4 mb-6"
              style={{ background: "#FFF8F8", border: "1px solid #FECACA" }}
            >
              <p className="text-[14px] font-semibold text-[#991B1B]">
                Isso não pode ser desfeito
              </p>
              <p className="text-[13px] text-[#7F1D1D] mt-1">
                O acesso <strong>{LABEL_TIPO_ACESSO[editando?.tipo ?? "OUTRO"]}</strong>
                {editando?.rotulo ? ` (${editando.rotulo})` : ""} será apagado, com
                usuário e senha.
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
                {editando ? "Editar acesso" : "Novo acesso"}
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
              <div>
                <p className="text-[13px] font-semibold text-ink-secondary mb-1.5">
                  Portal
                </p>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_ACESSO.map((t) => {
                    const ativo = tipo === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setTipo(t)}
                        className="h-[36px] px-3.5 rounded-full font-semibold text-[14px] transition-colors"
                        style={
                          ativo
                            ? { border: "1px solid #87BBF8", background: "#EAF1FD", color: "#2F63C9" }
                            : { border: "1px solid #E3E6EC", background: "#fff", color: "#5B616E" }
                        }
                      >
                        {LABEL_TIPO_ACESSO[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Campo label="Rótulo" opcional>
                <InputTexto
                  valor={rotulo}
                  onChange={setRotulo}
                  placeholder="Ex: NFSe Cascavel"
                  autoFocus={!editando}
                />
                <span className="block text-[12px] text-ink-muted mt-1.5">
                  Distingue dois acessos do mesmo portal — a empresa pode ter NFS-e
                  em mais de um município.
                </span>
              </Campo>

              <Campo label="Usuário" opcional>
                <InputTexto valor={usuario} onChange={setUsuario} placeholder="CNPJ ou login" />
              </Campo>

              <Campo label="Senha" opcional>
                <span
                  className="flex items-center h-[46px] px-4 bg-surface rounded-xl focus-within:border-brand transition-colors"
                  style={ESTILO_BORDA}
                >
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Senha do portal"
                    className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-placeholder font-sans"
                  />
                  <button
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Revelar senha"}
                    className="shrink-0 text-ink-secondary hover:text-ink transition-colors"
                  >
                    <IconeOlho aberto={mostrarSenha} />
                  </button>
                </span>
              </Campo>

              <Campo label="Link do portal" opcional>
                <InputTexto valor={link} onChange={setLink} placeholder="https://…" />
              </Campo>

              <Campo label="Observações" opcional>
                <InputTexto valor={notes} onChange={setNotes} placeholder="Ex: token no celular do sócio" />
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
                disabled={salvando}
                className="flex-1 h-12 rounded-full text-white font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  background: "#4078E6",
                  boxShadow: "0 6px 16px -4px rgba(64,120,230,.45)",
                  border: "none",
                }}
              >
                {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar acesso"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Aba ──────────────────────────────────────────────────────────────────────

export function AbaAcessos({
  empresaId,
  acessos,
  onRecarregar,
}: {
  empresaId: string;
  acessos: Acesso[];
  onRecarregar: () => void;
}) {
  const { setOnAdicionar } = useHeaderActionsStore();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Acesso | null>(null);

  useEffect(() => {
    setOnAdicionar(() => {
      setEditando(null);
      setModal(true);
    });
    return () => setOnAdicionar(null);
  }, [setOnAdicionar]);

  async function abrirPortal(link: string) {
    try {
      await open(link);
    } catch (e) {
      tratarErro(e, {
        contexto: "abrir portal",
        mensagemUsuario: "Não foi possível abrir o link no navegador.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {acessos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2">
          <p className="text-sm font-medium text-ink-muted">
            Nenhum acesso cadastrado nesta empresa.
          </p>
          <p className="text-[12.5px] text-ink-muted max-w-[400px] text-center">
            Guarde aqui o login da NFS-e do município, do gov.br e o código do
            Simples — é o que se procura na correria do fechamento.
          </p>
          <button
            onClick={() => {
              setEditando(null);
              setModal(true);
            }}
            className="mt-1 text-sm font-semibold text-brand hover:underline"
          >
            Adicionar o primeiro
          </button>
        </div>
      ) : (
        acessos.map((a) => {
          const chip = CHIP_TIPO[a.tipo];
          return (
            <div
              key={a.id}
              className="bg-surface border rounded-2xl px-5 py-4"
              style={{ borderColor: "#E3E6EC" }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className="inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-bold shrink-0"
                  style={{ background: chip.bg, color: chip.cor }}
                >
                  {LABEL_TIPO_ACESSO[a.tipo]}
                </span>
                <p className="font-bold text-[14.5px] text-ink truncate flex-1 min-w-0">
                  {a.rotulo || LABEL_TIPO_ACESSO[a.tipo]}
                </p>
                {a.link && (
                  <BotaoIcone onClick={() => abrirPortal(a.link!)} titulo="Abrir portal">
                    <IconeAbrir />
                  </BotaoIcone>
                )}
                <button
                  onClick={() => {
                    setEditando(a);
                    setModal(true);
                  }}
                  className="shrink-0 text-[13px] font-semibold text-brand hover:underline"
                >
                  Editar
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {a.usuario && <LinhaCredencial rotulo="Usuário" valor={a.usuario} />}
                {a.senha && <LinhaCredencial rotulo="Senha" valor={a.senha} secreta />}
                {!a.usuario && !a.senha && (
                  <p className="text-[12.5px] text-ink-muted">
                    Sem credencial salva — só o link do portal.
                  </p>
                )}
              </div>

              {a.notes && (
                <p className="text-[12.5px] text-ink-muted mt-2.5 pt-2.5 border-t border-border-subtle">
                  {a.notes}
                </p>
              )}
            </div>
          );
        })
      )}

      {modal && (
        <ModalAcesso
          empresaId={empresaId}
          editando={editando}
          onSalvo={() => {
            setModal(false);
            setEditando(null);
            onRecarregar();
          }}
          onFechar={() => {
            setModal(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}
