/**
 * Importa a planilha de controle do escritório (PARALEGAL) para o banco local.
 *
 *   npx vite-node scripts/importar-planilha.ts -- --arquivo="C:/.../PARALEGAL att.xlsx"
 *
 * Roda sob `vite-node` (e não `node`) de propósito: assim reaproveita o
 * catálogo de obrigações de `@/consts/obrigacoes` em vez de reimplementar as
 * regras de vencimento aqui — o alias `@` vem do vite.config.ts.
 *
 * É reexecutável: toda escrita procura a chave natural do registro antes
 * (CNPJ, CPF, empresa+tipo+rótulo, empresa+competência…) e atualiza em vez de
 * duplicar. Os lançamentos financeiros, que não têm chave natural, levam a
 * marca `[planilha:PARALEGAL]` em `notes` e podem ser removidos com
 * `--desfazer`.
 *
 * Flags:
 *   --arquivo=<caminho>       .xlsx de origem (obrigatório, salvo em --desfazer)
 *   --banco=<caminho>         quibo.db alvo (padrão: pasta de dados do app)
 *   --competencia-receita=AAAA-MM   mês da aba RECEITA, que não tem data
 *   --dry-run                 lê, valida e relata sem gravar nada
 *   --desfazer                apaga os lançamentos financeiros marcados
 *
 * `--desfazer` mexe só nos lançamentos: empresas, sócios, acessos, receitas,
 * obrigações e processos têm chave natural, então reimportar já os corrige no
 * lugar — apagá-los levaria junto a edição feita pelo usuário no app.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import ExcelJS from "exceljs";

import { calcularVencimento, obterObrigacao } from "@/consts/obrigacoes";

import {
  checklistIndicaZerado,
  normalizarCnpj,
  normalizarCpf,
  normalizarFormaPagamento,
  normalizarRegime,
  normalizarSituacao,
  paraCentavos,
  paraDataISO,
  rotuloAcessoPorLink,
  separarCidadeUf,
  statusDoChecklist,
  textoOuNulo,
  tipoAcessoPorLink,
  type TipoAcesso,
} from "./planilha/normalizar";

// ─── Marca de origem ──────────────────────────────────────────────────────────

/** Assinatura em `notes` do que veio da planilha — é o que `--desfazer` procura. */
const MARCA = "[planilha:PARALEGAL]";

// ─── Utilidades ───────────────────────────────────────────────────────────────

type Celula = ExcelJS.Cell | undefined;

/** Valor de célula → texto, resolvendo fórmula, rich text e hyperlink. */
function txt(celula: Celula): string {
  const v = celula?.value;
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((p) => p.text).join("").trim();
    }
    if ("result" in o) return o.result == null ? "" : String(o.result).trim();
    if ("text" in o) return String(o.text).trim();
    if ("hyperlink" in o) return String(o.hyperlink).trim();
    if ("error" in o) return "";
  }
  return String(v).trim();
}

/** Valor de célula preservando número e Date, para os normalizadores. */
function bruto(celula: Celula): string | number | Date | null {
  const v = celula?.value;
  if (v == null) return null;
  if (typeof v === "number" || v instanceof Date) return v;
  if (typeof v === "object" && "result" in (v as object)) {
    const r = (v as { result: unknown }).result;
    if (typeof r === "number" || r instanceof Date) return r;
  }
  return txt(celula);
}

function centavosDaCelula(celula: Celula): number | null {
  const v = bruto(celula);
  if (v instanceof Date) return null;
  return paraCentavos(v);
}

function uid(): string {
  return crypto.randomUUID();
}

function agora(): string {
  return new Date().toISOString();
}

/** `"2026-07-01"` → `{ mes: 7, ano: 2026 }`. */
function competenciaDe(valor: string | Date | null): { mes: number; ano: number } | null {
  const iso = paraDataISO(valor as string | Date | null);
  if (!iso) return null;
  return { mes: Number(iso.slice(5, 7)), ano: Number(iso.slice(0, 4)) };
}

// ─── Relatório ────────────────────────────────────────────────────────────────

type Relatorio = {
  contadores: Map<string, number>;
  avisos: string[];
};

function conta(rel: Relatorio, chave: string, n = 1): void {
  rel.contadores.set(chave, (rel.contadores.get(chave) ?? 0) + n);
}

function avisa(rel: Relatorio, mensagem: string): void {
  if (!rel.avisos.includes(mensagem)) rel.avisos.push(mensagem);
}

// ─── Banco ────────────────────────────────────────────────────────────────────

/** Pasta de dados do app por plataforma (mesma lógica do Makefile). */
function caminhoBancoPadrao(): string {
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming");
    return path.join(appdata, "app.quibo", "quibo.db");
  }
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Application Support", "app.quibo", "quibo.db");
  }
  return path.join(homedir(), ".local", "share", "app.quibo", "quibo.db");
}

type Banco = InstanceType<typeof DatabaseSync>;

/** Primeira linha de um SELECT, ou null. */
function uma<T = Record<string, unknown>>(
  db: Banco,
  sql: string,
  params: unknown[] = []
): T | null {
  const linhas = db.prepare(sql).all(...(params as never[])) as T[];
  return linhas.length > 0 ? linhas[0] : null;
}

// ─── Empresas, sócios e acessos (aba BANCO DE DADOS) ──────────────────────────

/**
 * Colunas da aba BANCO DE DADOS (1-based, como o ExcelJS entrega).
 * As colunas W+ da planilha são um bloco colado da aba FISCAL e são ignoradas.
 */
const COL_BD = {
  cnpj: 2,
  razao: 3,
  acessoUsuario: 4,
  acessoSenha: 5,
  acessoLink: 6,
  codigoSimples: 7,
  regime: 8,
  inscricaoEstadual: 9,
  procuracao: 10,
  responsavel: 11,
  cpf: 12,
  gov: 13,
  quotas: 14,
  inicioAtividades: 15,
  cidade: 16,
  email: 17,
  telefone: 18,
  regimeAlt: 19,
  honorarios: 20,
  situacao: 21,
  folha: 22,
} as const;

/** Acha a empresa pelo CNPJ, ou cria/atualiza a partir da linha da planilha. */
function upsertEmpresa(
  db: Banco,
  dados: {
    cnpj: string;
    razaoSocial: string;
    regime: string;
    inscricaoEstadual: string | null;
    dataAbertura: string | null;
    municipio: string | null;
    uf: string | null;
    email: string | null;
    telefone: string | null;
    honorariosCents: number;
    capitalSocialCents: number;
    procuracaoResponsavel: string | null;
    status: string;
    semMovimento: boolean;
    temFuncionarios: boolean;
    notes: string | null;
  },
  rel: Relatorio
): string {
  const ts = agora();
  const existente = uma<{ id: string }>(
    db,
    `SELECT id FROM empresas WHERE cnpj = ? AND archived = 0`,
    [dados.cnpj]
  );

  if (existente) {
    db.prepare(
      `UPDATE empresas
          SET razao_social = ?, regime_tributario = ?, inscricao_estadual = COALESCE(?, inscricao_estadual),
              data_abertura = COALESCE(?, data_abertura), municipio = COALESCE(?, municipio),
              uf = COALESCE(?, uf), email = COALESCE(?, email), telefone = COALESCE(?, telefone),
              honorarios_cents = ?, capital_social_cents = ?,
              procuracao_responsavel = COALESCE(?, procuracao_responsavel),
              status = ?, sem_movimento = ?, tem_funcionarios = ?,
              notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?`
    ).run(
      dados.razaoSocial,
      dados.regime,
      dados.inscricaoEstadual,
      dados.dataAbertura,
      dados.municipio,
      dados.uf,
      dados.email,
      dados.telefone,
      dados.honorariosCents,
      dados.capitalSocialCents,
      dados.procuracaoResponsavel,
      dados.status,
      dados.semMovimento ? 1 : 0,
      dados.temFuncionarios ? 1 : 0,
      dados.notes,
      ts,
      existente.id
    );
    conta(rel, "empresas atualizadas");
    return existente.id;
  }

  const id = uid();
  db.prepare(
    `INSERT INTO empresas
       (id, razao_social, cnpj, inscricao_estadual, data_abertura, municipio, uf,
        regime_tributario, status, tem_funcionarios, email, telefone,
        honorarios_cents, capital_social_cents, procuracao_responsavel,
        sem_movimento, notes, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    dados.razaoSocial,
    dados.cnpj,
    dados.inscricaoEstadual,
    dados.dataAbertura,
    dados.municipio,
    dados.uf,
    dados.regime,
    dados.status,
    dados.temFuncionarios ? 1 : 0,
    dados.email,
    dados.telefone,
    dados.honorariosCents,
    dados.capitalSocialCents,
    dados.procuracaoResponsavel,
    dados.semMovimento ? 1 : 0,
    dados.notes,
    ts,
    ts
  );
  conta(rel, "empresas criadas");
  return id;
}

/** Sócio é cadastro global reaproveitado por CPF entre empresas. */
function upsertSocio(
  db: Banco,
  nome: string,
  cpf: string | null,
  rel: Relatorio
): string {
  const ts = agora();
  const existente = cpf
    ? uma<{ id: string }>(db, `SELECT id FROM socios WHERE cpf = ? AND archived = 0`, [cpf])
    : uma<{ id: string }>(
        db,
        `SELECT id FROM socios WHERE nome = ? AND cpf IS NULL AND archived = 0`,
        [nome]
      );

  if (existente) {
    db.prepare(`UPDATE socios SET nome = ?, updated_at = ? WHERE id = ?`).run(
      nome,
      ts,
      existente.id
    );
    return existente.id;
  }

  const id = uid();
  db.prepare(
    `INSERT INTO socios (id, nome, cpf, archived, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`
  ).run(id, nome, cpf, ts, ts);
  conta(rel, "sócios criados");
  return id;
}

function vincularSocio(
  db: Banco,
  empresaId: string,
  socioId: string,
  rel: Relatorio
): void {
  const ts = agora();
  const existente = uma<{ id: string }>(
    db,
    `SELECT id FROM empresa_socios WHERE empresa_id = ? AND socio_id = ?`,
    [empresaId, socioId]
  );
  if (existente) return;

  // A planilha lista um único responsável por empresa, então ele entra como
  // administrador com 100% das quotas (10000 centésimos de %). Quadro
  // societário real com mais de um sócio é ajustado depois, na tela da empresa.
  db.prepare(
    `INSERT INTO empresa_socios
       (id, empresa_id, socio_id, participacao_centesimos, is_administrador,
        pro_labore_cents, recebe_distribuicao, created_at, updated_at)
     VALUES (?, ?, ?, 10000, 1, 0, 1, ?, ?)`
  ).run(uid(), empresaId, socioId, ts, ts);
  conta(rel, "vínculos societários criados");
}

function upsertAcesso(
  db: Banco,
  empresaId: string,
  acesso: {
    tipo: TipoAcesso;
    rotulo: string | null;
    usuario: string | null;
    senha: string | null;
    link: string | null;
  },
  rel: Relatorio
): void {
  if (!acesso.usuario && !acesso.senha && !acesso.link) return;

  const ts = agora();
  const existente = uma<{ id: string }>(
    db,
    `SELECT id FROM empresa_acessos
      WHERE empresa_id = ? AND tipo = ? AND COALESCE(rotulo, '') = ?`,
    [empresaId, acesso.tipo, acesso.rotulo ?? ""]
  );

  if (existente) {
    db.prepare(
      `UPDATE empresa_acessos
          SET usuario = COALESCE(?, usuario), senha = COALESCE(?, senha),
              link = COALESCE(?, link), updated_at = ?
        WHERE id = ?`
    ).run(acesso.usuario, acesso.senha, acesso.link, ts, existente.id);
    conta(rel, "acessos atualizados");
    return;
  }

  db.prepare(
    `INSERT INTO empresa_acessos
       (id, empresa_id, tipo, rotulo, usuario, senha, link, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uid(),
    empresaId,
    acesso.tipo,
    acesso.rotulo,
    acesso.usuario,
    acesso.senha,
    acesso.link,
    ts,
    ts
  );
  conta(rel, "acessos criados");
}

/** Índice CNPJ → empresa_id, para as abas que só trazem o CNPJ. */
type IndiceEmpresas = Map<string, { id: string; razaoSocial: string }>;

function importarEmpresas(
  db: Banco,
  ws: ExcelJS.Worksheet,
  rel: Relatorio
): IndiceEmpresas {
  const indice: IndiceEmpresas = new Map();

  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return; // cabeçalho

    const razaoSocial = txt(row.getCell(COL_BD.razao));
    const cnpjBruto = txt(row.getCell(COL_BD.cnpj));
    if (!razaoSocial && !cnpjBruto) return;

    const cnpj = normalizarCnpj(cnpjBruto);
    if (!cnpj) {
      avisa(
        rel,
        `Linha ${numero}: "${razaoSocial || "(sem razão social)"}" sem CNPJ válido ` +
          `(${cnpjBruto || "vazio"}) — empresa não importada.`
      );
      conta(rel, "linhas ignoradas (CNPJ inválido)");
      return;
    }

    const regime =
      normalizarRegime(txt(row.getCell(COL_BD.regime))) ??
      normalizarRegime(txt(row.getCell(COL_BD.regimeAlt)));
    if (!regime) {
      avisa(rel, `"${razaoSocial}": regime não informado — assumido SIMPLES.`);
    }

    const situacao = normalizarSituacao(txt(row.getCell(COL_BD.situacao)));
    const { municipio, uf } = separarCidadeUf(txt(row.getCell(COL_BD.cidade)));
    const folhaCents = centavosDaCelula(row.getCell(COL_BD.folha)) ?? 0;

    const observacoes: string[] = [];
    if (situacao.aConferir) observacoes.push("Situação marcada como “?” na planilha.");

    const empresaId = upsertEmpresa(
      db,
      {
        cnpj,
        razaoSocial,
        regime: regime ?? "SIMPLES",
        inscricaoEstadual: textoOuNulo(txt(row.getCell(COL_BD.inscricaoEstadual))),
        dataAbertura: paraDataISO(bruto(row.getCell(COL_BD.inicioAtividades)) as string | Date | null),
        municipio,
        uf,
        email: textoOuNulo(txt(row.getCell(COL_BD.email))),
        telefone: textoOuNulo(txt(row.getCell(COL_BD.telefone))),
        honorariosCents: centavosDaCelula(row.getCell(COL_BD.honorarios)) ?? 0,
        capitalSocialCents: centavosDaCelula(row.getCell(COL_BD.quotas)) ?? 0,
        procuracaoResponsavel: textoOuNulo(txt(row.getCell(COL_BD.procuracao))),
        status: situacao.status,
        semMovimento: situacao.semMovimento,
        temFuncionarios: folhaCents > 0,
        notes: observacoes.length > 0 ? observacoes.join(" ") : null,
      },
      rel
    );

    indice.set(cnpj, { id: empresaId, razaoSocial });

    // ── Sócio responsável ────────────────────────────────────────────────────
    const nomeResponsavel = textoOuNulo(txt(row.getCell(COL_BD.responsavel)));
    const cpfBruto = txt(row.getCell(COL_BD.cpf));
    if (nomeResponsavel) {
      const cpf = normalizarCpf(cpfBruto);
      if (cpfBruto && !cpf) {
        avisa(
          rel,
          `"${razaoSocial}": CPF "${cpfBruto}" não tem 11 dígitos — sócio criado sem CPF.`
        );
      }
      const socioId = upsertSocio(db, nomeResponsavel, cpf, rel);
      vincularSocio(db, empresaId, socioId, rel);
    }

    // ── Acessos ──────────────────────────────────────────────────────────────
    const link = textoOuNulo(txt(row.getCell(COL_BD.acessoLink)));
    upsertAcesso(
      db,
      empresaId,
      {
        tipo: tipoAcessoPorLink(link ?? "", "PREFEITURA"),
        rotulo: link ? rotuloAcessoPorLink(link) : null,
        usuario: textoOuNulo(txt(row.getCell(COL_BD.acessoUsuario))),
        senha: textoOuNulo(txt(row.getCell(COL_BD.acessoSenha))),
        link,
      },
      rel
    );

    const codigoSimples = textoOuNulo(txt(row.getCell(COL_BD.codigoSimples)));
    if (codigoSimples) {
      upsertAcesso(
        db,
        empresaId,
        {
          tipo: "SIMPLES_NACIONAL",
          rotulo: null,
          usuario: cnpj,
          senha: codigoSimples,
          link: null,
        },
        rel
      );
    }

    const senhaGov = textoOuNulo(txt(row.getCell(COL_BD.gov)));
    if (senhaGov) {
      upsertAcesso(
        db,
        empresaId,
        {
          tipo: "GOV_BR",
          rotulo: null,
          usuario: normalizarCpf(cpfBruto) ?? cnpj,
          senha: senhaGov,
          link: "https://sso.acesso.gov.br",
        },
        rel
      );
    }
  });

  return indice;
}

// ─── Receitas mensais (aba FISCAL) ────────────────────────────────────────────

function upsertReceita(
  db: Banco,
  empresaId: string,
  mes: number,
  ano: number,
  receitaCents: number,
  rel: Relatorio
): void {
  const ts = agora();
  const existente = uma<{ id: string }>(
    db,
    `SELECT id FROM empresa_receitas WHERE empresa_id = ? AND mes = ? AND ano = ?`,
    [empresaId, mes, ano]
  );

  if (existente) {
    db.prepare(
      `UPDATE empresa_receitas SET receita_cents = ?, updated_at = ? WHERE id = ?`
    ).run(receitaCents, ts, existente.id);
    conta(rel, "receitas atualizadas");
    return;
  }

  db.prepare(
    `INSERT INTO empresa_receitas
       (id, empresa_id, mes, ano, receita_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uid(), empresaId, mes, ano, receitaCents, ts, ts);
  conta(rel, "receitas criadas");
}

/** Resolve o CNPJ da linha contra o índice, avisando quando a empresa não existe. */
function acharEmpresa(
  indice: IndiceEmpresas,
  cnpjBruto: string,
  contexto: string,
  rel: Relatorio
): { id: string; razaoSocial: string } | null {
  const cnpj = normalizarCnpj(cnpjBruto);
  if (!cnpj) return null;
  const empresa = indice.get(cnpj);
  if (!empresa) {
    avisa(rel, `${contexto}: CNPJ ${cnpjBruto} não está na aba BANCO DE DADOS — linha ignorada.`);
  }
  return empresa ?? null;
}

function importarFiscal(
  db: Banco,
  ws: ExcelJS.Worksheet,
  indice: IndiceEmpresas,
  rel: Relatorio
): void {
  const cabecalho = ws.getRow(1);

  // A partir da coluna 6 cada coluna é um mês; o cabeçalho traz a competência.
  const meses: { coluna: number; mes: number; ano: number }[] = [];
  for (let c = 6; c <= ws.columnCount; c++) {
    const comp = competenciaDe(bruto(cabecalho.getCell(c)) as string | Date | null);
    if (comp) meses.push({ coluna: c, ...comp });
  }

  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;

    const empresa = acharEmpresa(indice, txt(row.getCell(1)), "Aba FISCAL", rel);
    if (!empresa) return;

    // A aba repete as credenciais do portal de NFSe; a chave natural do acesso
    // faz isso virar atualização, não duplicata.
    const link = textoOuNulo(txt(row.getCell(5)));
    upsertAcesso(
      db,
      empresa.id,
      {
        tipo: tipoAcessoPorLink(link ?? "", "PREFEITURA"),
        rotulo: link ? rotuloAcessoPorLink(link) : null,
        usuario: textoOuNulo(txt(row.getCell(3))),
        senha: textoOuNulo(txt(row.getCell(4))),
        link,
      },
      rel
    );

    for (const { coluna, mes, ano } of meses) {
      // A célula ou traz receita (número) ou um marcador de conferência
      // ("OK"/"X"), que não é valor e não vira receita.
      const cents = centavosDaCelula(row.getCell(coluna));
      if (cents == null) continue;
      upsertReceita(db, empresa.id, mes, ano, cents, rel);
    }
  });
}

// ─── Checklist mensal (aba PROCESSOS) ─────────────────────────────────────────

/**
 * Colunas do checklist → código do catálogo de obrigações.
 * "NFSe Emitida" e "Receita PR" não são obrigações acessórias do catálogo:
 * a primeira é um fato do mês, a segunda é um pedido estadual. Ambas viram
 * observação na ocorrência do DAS em vez de virar obrigação inventada.
 */
const CHECKLIST_OBRIGACOES: { coluna: number; codigo: string; rotulo: string }[] = [
  { coluna: 5, codigo: "ISS_MENSAL", rotulo: "ISS" },
  { coluna: 8, codigo: "DAS", rotulo: "DAS" },
  { coluna: 9, codigo: "INSS_DARF", rotulo: "Pró-labore" },
];

function upsertOcorrencia(
  db: Banco,
  empresaId: string,
  codigo: string,
  mes: number,
  ano: number,
  status: string,
  notes: string | null,
  rel: Relatorio
): void {
  const def = obterObrigacao(codigo);
  if (!def) {
    avisa(rel, `Obrigação "${codigo}" não existe no catálogo — ocorrência ignorada.`);
    return;
  }

  const vencimento = calcularVencimento(def, mes, ano);
  const ts = agora();
  const concluidaEm = status === "ENTREGUE" || status === "PAGA" ? ts : null;

  const existente = uma<{ id: string }>(
    db,
    `SELECT id FROM obrigacoes_ocorrencias
      WHERE empresa_id = ? AND obrigacao_codigo = ?
        AND competencia_mes = ? AND competencia_ano = ?`,
    [empresaId, codigo, mes, ano]
  );

  if (existente) {
    db.prepare(
      `UPDATE obrigacoes_ocorrencias
          SET status = ?, concluida_em = ?, notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?`
    ).run(status, concluidaEm, notes, ts, existente.id);
    conta(rel, "obrigações atualizadas");
    return;
  }

  db.prepare(
    `INSERT INTO obrigacoes_ocorrencias
       (id, empresa_id, obrigacao_codigo, competencia_mes, competencia_ano,
        vencimento, status, concluida_em, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uid(), empresaId, codigo, mes, ano, vencimento, status, concluidaEm, notes, ts, ts);
  conta(rel, "obrigações criadas");
}

function importarChecklistMensal(
  db: Banco,
  ws: ExcelJS.Worksheet,
  indice: IndiceEmpresas,
  rel: Relatorio
): void {
  const comp = competenciaDe(bruto(ws.getRow(1).getCell(4)) as string | Date | null);
  if (!comp) {
    avisa(rel, "Aba PROCESSOS sem competência no cabeçalho (D1) — aba ignorada.");
    return;
  }

  const vistos = new Set<string>();

  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;

    const empresa = acharEmpresa(indice, txt(row.getCell(1)), "Aba PROCESSOS", rel);
    if (!empresa) return;

    // A planilha tem a mesma empresa repetida em duas linhas; a primeira vence.
    if (vistos.has(empresa.id)) {
      conta(rel, "linhas duplicadas ignoradas (checklist)");
      return;
    }
    vistos.add(empresa.id);

    // Coluna D é a receita da competência.
    const receitaCents = centavosDaCelula(row.getCell(4));
    if (receitaCents != null) {
      upsertReceita(db, empresa.id, comp.mes, comp.ano, receitaCents, rel);
    }

    const nfse = txt(row.getCell(7));
    const receitaPr = txt(row.getCell(6));
    const contexto = [
      nfse ? `NFSe: ${nfse}` : null,
      receitaPr ? `Receita PR: ${receitaPr}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    let zeradoNoMes = false;

    for (const { coluna, codigo, rotulo } of CHECKLIST_OBRIGACOES) {
      const celula = txt(row.getCell(coluna));
      const status = statusDoChecklist(celula);
      if (!status) continue;

      if (checklistIndicaZerado(celula)) zeradoNoMes = true;

      const notes = [`${rotulo}: ${celula}`, contexto].filter(Boolean).join(" · ");
      upsertOcorrencia(db, empresa.id, codigo, comp.mes, comp.ano, status, notes, rel);
    }

    if (zeradoNoMes) {
      db.prepare(`UPDATE empresas SET sem_movimento = 1, updated_at = ? WHERE id = ?`).run(
        agora(),
        empresa.id
      );
      conta(rel, "empresas marcadas sem movimento");
    }

    // "Parcelamento: Emitido" é trabalho administrativo, não obrigação acessória.
    const parcelamento = txt(row.getCell(10));
    if (parcelamento) {
      upsertProcesso(
        db,
        empresa.id,
        {
          titulo: "Parcelamento",
          tipo: "PARCELAMENTO",
          descricao: `Planilha (${String(comp.mes).padStart(2, "0")}/${comp.ano}): ${parcelamento}`,
          protocolo: null,
          link: null,
          status: statusDoChecklist(parcelamento) === "ENTREGUE" ? "CONCLUIDO" : "EM_ANDAMENTO",
        },
        rel
      );
    }
  });
}

// ─── Processos (abas SOCIETARIO e BOMBEIROS) ──────────────────────────────────

function upsertProcesso(
  db: Banco,
  empresaId: string,
  dados: {
    titulo: string;
    tipo: string;
    descricao: string | null;
    protocolo: string | null;
    link: string | null;
    status: string;
  },
  rel: Relatorio
): void {
  const ts = agora();

  // Protocolo é a identidade do processo no órgão; sem ele, o título serve.
  const existente = dados.protocolo
    ? uma<{ id: string }>(
        db,
        `SELECT id FROM processos WHERE empresa_id = ? AND protocolo = ?`,
        [empresaId, dados.protocolo]
      )
    : uma<{ id: string }>(
        db,
        `SELECT id FROM processos WHERE empresa_id = ? AND titulo = ? AND protocolo IS NULL`,
        [empresaId, dados.titulo]
      );

  if (existente) {
    db.prepare(
      `UPDATE processos
          SET titulo = ?, tipo = ?, descricao = COALESCE(?, descricao),
              link = COALESCE(?, link), status = ?, updated_at = ?
        WHERE id = ?`
    ).run(dados.titulo, dados.tipo, dados.descricao, dados.link, dados.status, ts, existente.id);
    conta(rel, "processos atualizados");
    return;
  }

  db.prepare(
    `INSERT INTO processos
       (id, empresa_id, titulo, tipo, descricao, status, protocolo, link, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uid(),
    empresaId,
    dados.titulo,
    dados.tipo,
    dados.descricao,
    dados.status,
    dados.protocolo,
    dados.link,
    ts,
    ts
  );
  conta(rel, "processos criados");
}

/** Só aceita link de verdade — a planilha às vezes tem o texto do link na célula. */
function urlOuNulo(valor: string): string | null {
  const t = valor.trim();
  return t.startsWith("http://") || t.startsWith("https://") ? t : null;
}

function importarSocietario(
  db: Banco,
  ws: ExcelJS.Worksheet,
  indice: IndiceEmpresas,
  rel: Relatorio
): void {
  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;

    const empresa = acharEmpresa(indice, txt(row.getCell(1)), "Aba SOCIETARIO", rel);
    if (!empresa) return;

    const alteracao = txt(row.getCell(5)).toUpperCase();
    const ehAbertura = alteracao.includes("CONSTITU");
    const protocolo = textoOuNulo(txt(row.getCell(3)));
    const nire = textoOuNulo(txt(row.getCell(6)));

    upsertProcesso(
      db,
      empresa.id,
      {
        titulo: ehAbertura ? "Constituição na Junta" : "Alteração contratual",
        tipo: ehAbertura ? "ABERTURA" : "ALTERACAO",
        descricao: nire ? `NIRE ${nire}` : null,
        protocolo,
        link: urlOuNulo(txt(row.getCell(4))),
        status: "EM_ANDAMENTO",
      },
      rel
    );
  });
}

function importarBombeiros(
  db: Banco,
  ws: ExcelJS.Worksheet,
  indice: IndiceEmpresas,
  rel: Relatorio
): void {
  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;

    const empresa = acharEmpresa(indice, txt(row.getCell(1)), "Aba BOMBEIROS", rel);
    if (!empresa) return;

    const taxa = txt(row.getCell(5));

    upsertProcesso(
      db,
      empresa.id,
      {
        titulo: "Corpo de Bombeiros (Redesim)",
        tipo: "REGULARIZACAO",
        descricao: taxa ? `Taxa de Corpo de Bombeiros: ${taxa}` : null,
        protocolo: textoOuNulo(txt(row.getCell(3))),
        link: urlOuNulo(txt(row.getCell(4))),
        status: taxa.toUpperCase().includes("PENDENTE") ? "EM_ANDAMENTO" : "CONCLUIDO",
      },
      rel
    );
  });
}

// ─── Financeiro pessoal (aba Planilha4) ───────────────────────────────────────

function acharOuCriarPersona(db: Banco, nome: string, rel: Relatorio): string | null {
  const limpo = textoOuNulo(nome);
  if (!limpo) return null;

  const existente = uma<{ id: string }>(
    db,
    `SELECT id FROM personas WHERE name = ? COLLATE NOCASE AND archived = 0`,
    [limpo]
  );
  if (existente) return existente.id;

  const id = uid();
  const ts = agora();
  db.prepare(
    `INSERT INTO personas (id, name, archived, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?)`
  ).run(id, limpo, ts, ts);
  conta(rel, "personas criadas");
  return id;
}

/**
 * Um lançamento do mês já existe se a Pluggy trouxe o mesmo valor na mesma
 * competência. É o que impede a planilha de duplicar o extrato bancário —
 * os cartões Nubank e Sicredi já vêm pelo Open Finance.
 */
function jaVeioDaPluggy(
  db: Banco,
  ano: number,
  mes: number,
  valorCents: number
): boolean {
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
  const linha = uma<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM transactions
      WHERE source = 'PLUGGY' AND amount_cents = ? AND date LIKE ?`,
    [valorCents, `${prefixo}%`]
  );
  return (linha?.n ?? 0) > 0;
}

/**
 * Quantas vezes cada lançamento já apareceu nesta execução.
 *
 * A planilha pode repetir a mesma linha de propósito (duas compras iguais no
 * mês). Contar as ocorrências permite reexecutar o import sem duplicar e sem
 * engolir a repetição legítima: na N-ésima vez que a chave aparece, só grava
 * se o banco ainda tiver menos de N linhas iguais.
 */
const ocorrenciasNaExecucao = new Map<string, number>();

function inserirLancamento(
  db: Banco,
  dados: {
    tipo: "INCOME" | "EXPENSE";
    descricao: string;
    valorCents: number;
    data: string;
    mes: number;
    ano: number;
    personaId: string | null;
    status: string;
    notes: string;
  },
  rel: Relatorio
): boolean {
  const chave = [dados.tipo, dados.descricao, dados.valorCents, dados.mes, dados.ano].join("|");
  const vez = (ocorrenciasNaExecucao.get(chave) ?? 0) + 1;
  ocorrenciasNaExecucao.set(chave, vez);

  const existentes = uma<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM transactions
      WHERE type = ? AND description = ? AND amount_cents = ?
        AND month = ? AND year = ? AND notes LIKE ?`,
    [dados.tipo, dados.descricao, dados.valorCents, dados.mes, dados.ano, `%${MARCA}%`]
  );

  if ((existentes?.n ?? 0) >= vez) {
    conta(rel, "lançamentos já importados (mantidos)");
    return false;
  }

  const ts = agora();
  db.prepare(
    `INSERT INTO transactions
       (id, type, status, description, amount_cents, date, month, year,
        persona_id, notes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?)`
  ).run(
    uid(),
    dados.tipo,
    dados.status,
    dados.descricao,
    dados.valorCents,
    dados.data,
    dados.mes,
    dados.ano,
    dados.personaId,
    dados.notes,
    ts,
    ts
  );
  return true;
}

function importarFaturaPessoal(
  db: Banco,
  ws: ExcelJS.Worksheet,
  rel: Relatorio
): void {
  const comp = competenciaDe(bruto(ws.getRow(2).getCell(2)) as string | Date | null);
  if (!comp) {
    avisa(rel, "Aba Planilha4 sem competência em B2 — aba ignorada.");
    return;
  }

  const data = `${comp.ano}-${String(comp.mes).padStart(2, "0")}-01`;

  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero <= 3) return; // data + cabeçalho

    const titular = txt(row.getCell(2));
    if (!titular || titular.toUpperCase() === "TOTAL") return;

    const valorCents = centavosDaCelula(row.getCell(8));
    if (valorCents == null || valorCents === 0) {
      conta(rel, "linhas da fatura sem valor");
      return;
    }

    const titulo = txt(row.getCell(5));
    const descricaoCol = txt(row.getCell(6));
    const cartao = txt(row.getCell(3));
    const banco = txt(row.getCell(4));
    const forma = normalizarFormaPagamento(txt(row.getCell(7)));

    if (jaVeioDaPluggy(db, comp.ano, comp.mes, valorCents)) {
      conta(rel, "lançamentos pulados (já vieram do Open Finance)");
      avisa(
        rel,
        `Fatura ${String(comp.mes).padStart(2, "0")}/${comp.ano}: "${titulo}" ` +
          `(R$ ${(valorCents / 100).toFixed(2)}) já existe via Pluggy — não duplicado.`
      );
      return;
    }

    const descricao = [titulo, textoOuNulo(descricaoCol)].filter(Boolean).join(" — ");

    // O cartão fica na observação, e não como `credit_card_id`: os cartões da
    // planilha são apelidos ("Sayonara/Caixa") sem correspondência nos cartões
    // sincronizados, e criar cartão novo exigiria inventar limite e datas de
    // fechamento/vencimento.
    const partes = [
      MARCA,
      cartao || banco ? `Cartão ${[cartao, banco].filter((p) => p && p !== "-").join(" · ")}` : null,
      forma.tipo === "PARCELA" ? `Parcela ${forma.atual}/${forma.total}` : null,
      forma.tipo === "RECORRENTE" ? "Recorrente" : null,
    ].filter(Boolean);

    const inserido = inserirLancamento(
      db,
      {
        tipo: "EXPENSE",
        descricao: descricao || "Lançamento da planilha",
        valorCents,
        data,
        mes: comp.mes,
        ano: comp.ano,
        personaId: acharOuCriarPersona(db, titular, rel),
        status: "PREVISTO",
        notes: partes.join(" · "),
      },
      rel
    );
    if (inserido) conta(rel, "lançamentos pessoais criados");
  });
}

// ─── Honorários e despesas do escritório (aba RECEITA) ────────────────────────

function importarReceitaEscritorio(
  db: Banco,
  ws: ExcelJS.Worksheet,
  competencia: { mes: number; ano: number },
  rel: Relatorio
): void {
  const data = `${competencia.ano}-${String(competencia.mes).padStart(2, "0")}-01`;

  // Dois blocos lado a lado: recebimentos (col. 1–4) e pagamentos (col. 15–18).
  const blocos = [
    { inicio: 1, tipo: "INCOME" as const, pagoQuando: "SIM", rotulo: "A receber" },
    { inicio: 15, tipo: "EXPENSE" as const, pagoQuando: "SIM", rotulo: "A pagar" },
  ];

  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;

    for (const bloco of blocos) {
      const pagador = textoOuNulo(txt(row.getCell(bloco.inicio)));
      const valorCents = centavosDaCelula(row.getCell(bloco.inicio + 2));
      if (!pagador || valorCents == null || valorCents === 0) continue;

      const tipoLancamento = txt(row.getCell(bloco.inicio + 1));
      const quitado =
        txt(row.getCell(bloco.inicio + 3)).trim().toUpperCase() === bloco.pagoQuando;

      const inserido = inserirLancamento(
        db,
        {
          tipo: bloco.tipo,
          descricao: [pagador, textoOuNulo(tipoLancamento)].filter(Boolean).join(" — "),
          valorCents,
          data,
          mes: competencia.mes,
          ano: competencia.ano,
          personaId: null,
          status: quitado ? "CONFIRMADO" : "PREVISTO",
          notes: `${MARCA} · Escritório · ${bloco.rotulo}`,
        },
        rel
      );
      if (inserido) {
        conta(
          rel,
          bloco.tipo === "INCOME" ? "honorários do escritório" : "despesas do escritório"
        );
      }
    }
  });
}

// ─── Desfazer ─────────────────────────────────────────────────────────────────

function desfazer(db: Banco, rel: Relatorio): void {
  const info = db
    .prepare(`DELETE FROM transactions WHERE notes LIKE ?`)
    .run(`%${MARCA}%`);
  conta(rel, "lançamentos removidos", Number(info.changes));
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function lerFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [chave, ...resto] = arg.slice(2).split("=");
    flags.set(chave, resto.join("=") || "true");
  }
  return flags;
}

function imprimirRelatorio(rel: Relatorio, dryRun: boolean): void {
  console.log("");
  console.log(dryRun ? "── Simulação (nada foi gravado) ──" : "── Importação concluída ──");

  const chaves = [...rel.contadores.keys()].sort();
  if (chaves.length === 0) {
    console.log("  (nada a fazer)");
  }
  for (const chave of chaves) {
    console.log(`  ${String(rel.contadores.get(chave)).padStart(5)}  ${chave}`);
  }

  if (rel.avisos.length > 0) {
    console.log("");
    console.log(`── Avisos (${rel.avisos.length}) ──`);
    for (const aviso of rel.avisos) console.log(`  • ${aviso}`);
  }
  console.log("");
}

async function main(): Promise<void> {
  const flags = lerFlags(process.argv.slice(2));
  const dryRun = flags.has("dry-run");
  const caminhoBanco = flags.get("banco") ?? caminhoBancoPadrao();

  if (!existsSync(caminhoBanco)) {
    console.error(`Banco não encontrado: ${caminhoBanco}`);
    console.error("Rode o app uma vez (ou `make migrate`) para criá-lo.");
    process.exit(1);
  }

  const db = new DatabaseSync(caminhoBanco);
  db.exec("PRAGMA foreign_keys = ON;");

  const rel: Relatorio = { contadores: new Map(), avisos: [] };

  try {
    if (flags.has("desfazer")) {
      console.log(`Desfazendo importações em ${caminhoBanco}…`);
      db.exec("BEGIN");
      desfazer(db, rel);
      db.exec(dryRun ? "ROLLBACK" : "COMMIT");
      imprimirRelatorio(rel, dryRun);
      return;
    }

    const arquivo = flags.get("arquivo");
    if (!arquivo) {
      console.error("Faltou --arquivo=<caminho do .xlsx>");
      process.exit(1);
    }
    if (!existsSync(arquivo)) {
      console.error(`Arquivo não encontrado: ${arquivo}`);
      process.exit(1);
    }

    console.log(`Planilha: ${arquivo}`);
    console.log(`Banco:    ${caminhoBanco}`);
    if (dryRun) console.log("Modo:     simulação (--dry-run)");
    console.log("");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(arquivo);

    const aba = (nome: string): ExcelJS.Worksheet | null => {
      const ws = wb.getWorksheet(nome);
      if (!ws) avisa(rel, `Aba "${nome}" não existe na planilha — pulada.`);
      return ws ?? null;
    };

    const bancoDados = aba("BANCO DE DADOS");
    if (!bancoDados) {
      console.error("A aba BANCO DE DADOS é obrigatória — ela é a fonte das empresas.");
      process.exit(1);
    }

    db.exec("BEGIN");

    const indice = importarEmpresas(db, bancoDados, rel);
    console.log(`Empresas reconhecidas: ${indice.size}`);

    const fiscal = aba("FISCAL");
    if (fiscal) importarFiscal(db, fiscal, indice, rel);

    const processos = aba("PROCESSOS");
    if (processos) importarChecklistMensal(db, processos, indice, rel);

    const societario = aba("SOCIETARIO");
    if (societario) importarSocietario(db, societario, indice, rel);

    const bombeiros = aba("BOMBEIROS");
    if (bombeiros) importarBombeiros(db, bombeiros, indice, rel);

    const fatura = aba("Planilha4");
    if (fatura) importarFaturaPessoal(db, fatura, rel);

    const receita = aba("RECEITA");
    if (receita) {
      const informada = flags.get("competencia-receita");
      const comp = informada
        ? competenciaDe(`${informada}-01`)
        : competenciaDe(new Date());
      if (!comp) {
        avisa(rel, `--competencia-receita="${informada}" inválida — aba RECEITA pulada.`);
      } else {
        console.log(
          `Aba RECEITA sem data própria — lançada em ${String(comp.mes).padStart(2, "0")}/${comp.ano}` +
            (informada ? "" : " (mês corrente; use --competencia-receita=AAAA-MM para mudar)")
        );
        importarReceitaEscritorio(db, receita, comp, rel);
      }
    }

    db.exec(dryRun ? "ROLLBACK" : "COMMIT");
    imprimirRelatorio(rel, dryRun);
  } catch (erro) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Sem transação aberta — nada a desfazer.
    }
    throw erro;
  } finally {
    db.close();
  }
}

main().catch((erro) => {
  console.error("");
  console.error("Falha na importação — nada foi gravado.");
  console.error(erro);
  process.exit(1);
});
