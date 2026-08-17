/**
 * Acessos a portais por empresa — NFSe do município, gov.br, código do
 * Simples, e-CAC, Junta, Bombeiros.
 *
 * É o dado mais consultado no dia a dia do escritório e o motivo de a planilha
 * continuar aberta o tempo todo. As senhas ficam em texto plano: o banco é
 * local, mono-usuário e nunca sai da máquina — mesma decisão de `app_settings`,
 * que guarda as chaves de API BYOK. A tela exibe mascarado e revelar é um
 * gesto explícito.
 */

import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoAcesso =
  | "NFSE"
  | "GOV_BR"
  | "SIMPLES_NACIONAL"
  | "ECAC"
  | "JUNTA"
  | "PREFEITURA"
  | "ESTADUAL"
  | "BOMBEIROS"
  | "BANCO"
  | "OUTRO";

export const TIPOS_ACESSO: TipoAcesso[] = [
  "NFSE",
  "PREFEITURA",
  "GOV_BR",
  "SIMPLES_NACIONAL",
  "ECAC",
  "ESTADUAL",
  "JUNTA",
  "BOMBEIROS",
  "BANCO",
  "OUTRO",
];

export const LABEL_TIPO_ACESSO: Record<TipoAcesso, string> = {
  NFSE: "NFS-e",
  GOV_BR: "gov.br",
  SIMPLES_NACIONAL: "Simples Nacional",
  ECAC: "e-CAC",
  JUNTA: "Junta comercial",
  PREFEITURA: "Prefeitura",
  ESTADUAL: "Sefaz estadual",
  BOMBEIROS: "Corpo de Bombeiros",
  BANCO: "Banco",
  OUTRO: "Outro",
};

export type Acesso = {
  id: string;
  empresaId: string;
  tipo: TipoAcesso;
  rotulo: string | null;
  usuario: string | null;
  senha: string | null;
  link: string | null;
  notes: string | null;
};

export type DadosAcesso = {
  tipo: TipoAcesso;
  rotulo: string | null;
  usuario: string | null;
  senha: string | null;
  link: string | null;
  notes: string | null;
};

type AcessoRow = {
  id: string;
  empresa_id: string;
  tipo: string;
  rotulo: string | null;
  usuario: string | null;
  senha: string | null;
  link: string | null;
  notes: string | null;
};

function mapearLinha(r: AcessoRow): Acesso {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    tipo: r.tipo as TipoAcesso,
    rotulo: r.rotulo ?? null,
    usuario: r.usuario ?? null,
    senha: r.senha ?? null,
    link: r.link ?? null,
    notes: r.notes ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarAcessos(empresaId: string): Promise<Acesso[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<AcessoRow[]>(
    `SELECT id, empresa_id, tipo, rotulo, usuario, senha, link, notes
       FROM empresa_acessos
      WHERE empresa_id = ?
      ORDER BY tipo, COALESCE(rotulo, '') COLLATE NOCASE`,
    [empresaId]
  );
  return rows.map(mapearLinha);
}

export async function criarAcesso(
  empresaId: string,
  dados: DadosAcesso
): Promise<string> {
  const sqlite = await getSqlite();
  const id = crypto.randomUUID();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO empresa_acessos
       (id, empresa_id, tipo, rotulo, usuario, senha, link, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      empresaId,
      dados.tipo,
      dados.rotulo?.trim() || null,
      dados.usuario?.trim() || null,
      dados.senha || null,
      dados.link?.trim() || null,
      dados.notes?.trim() || null,
      ts,
      ts,
    ]
  );
  return id;
}

export async function editarAcesso(
  id: string,
  dados: DadosAcesso
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE empresa_acessos
        SET tipo = ?, rotulo = ?, usuario = ?, senha = ?, link = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.tipo,
      dados.rotulo?.trim() || null,
      dados.usuario?.trim() || null,
      dados.senha || null,
      dados.link?.trim() || null,
      dados.notes?.trim() || null,
      agora(),
      id,
    ]
  );
}

export async function excluirAcesso(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM empresa_acessos WHERE id = ?`, [id]);
}
