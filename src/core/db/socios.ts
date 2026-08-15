import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Sócio com os dados do vínculo em uma empresa específica. */
export type SocioDaEmpresa = {
  /** id do vínculo (empresa_socios). */
  vinculoId: string;
  socioId: string;
  nome: string;
  /** Só dígitos (11) ou null. */
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  /** Centésimos de % (5000 = 50,00%). */
  participacaoCentesimos: number;
  isAdministrador: boolean;
  /** Centavos; 0 = não retira pró-labore. */
  proLaboreCents: number;
  recebeDistribuicao: boolean;
  dataEntrada: string | null;
  dataSaida: string | null;
};

export type DadosSocioVinculo = {
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  participacaoCentesimos: number;
  isAdministrador: boolean;
  proLaboreCents: number;
  recebeDistribuicao: boolean;
  dataEntrada: string | null;
  dataSaida: string | null;
};

type SocioDaEmpresaRow = {
  vinculo_id: string;
  socio_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  participacao_centesimos: number;
  is_administrador: number;
  pro_labore_cents: number;
  recebe_distribuicao: number;
  data_entrada: string | null;
  data_saida: string | null;
};

function mapearLinha(r: SocioDaEmpresaRow): SocioDaEmpresa {
  return {
    vinculoId: r.vinculo_id,
    socioId: r.socio_id,
    nome: r.nome,
    cpf: r.cpf ?? null,
    email: r.email ?? null,
    telefone: r.telefone ?? null,
    participacaoCentesimos: r.participacao_centesimos,
    isAdministrador: r.is_administrador === 1,
    proLaboreCents: r.pro_labore_cents,
    recebeDistribuicao: r.recebe_distribuicao === 1,
    dataEntrada: r.data_entrada ?? null,
    dataSaida: r.data_saida ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarSociosDaEmpresa(
  empresaId: string
): Promise<SocioDaEmpresa[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<SocioDaEmpresaRow[]>(
    `SELECT es.id AS vinculo_id, s.id AS socio_id, s.nome, s.cpf, s.email, s.telefone,
            es.participacao_centesimos, es.is_administrador, es.pro_labore_cents,
            es.recebe_distribuicao, es.data_entrada, es.data_saida
       FROM empresa_socios es
       JOIN socios s ON s.id = es.socio_id
      WHERE es.empresa_id = ?
      ORDER BY es.data_saida IS NOT NULL ASC, es.participacao_centesimos DESC,
               s.nome COLLATE NOCASE ASC`,
    [empresaId]
  );
  return rows.map(mapearLinha);
}

/**
 * Cria o sócio e o vínculo com a empresa. Se já existir um sócio ativo com o
 * mesmo CPF (cadastro global), o vínculo reaproveita esse sócio — é o caso de
 * uma pessoa que participa de mais de uma empresa.
 */
export async function adicionarSocio(
  empresaId: string,
  dados: DadosSocioVinculo
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();

  let socioId: string | null = null;
  if (dados.cpf) {
    const existentes = await sqlite.select<{ id: string }[]>(
      `SELECT id FROM socios WHERE cpf = ? AND archived = 0`,
      [dados.cpf]
    );
    if (existentes.length > 0) {
      socioId = existentes[0].id;
      // Mantém o cadastro global atualizado com o que foi digitado agora.
      await sqlite.execute(
        `UPDATE socios SET nome = ?, email = ?, telefone = ?, updated_at = ? WHERE id = ?`,
        [dados.nome.trim(), dados.email?.trim() || null, dados.telefone?.trim() || null, ts, socioId]
      );
    }
  }

  if (!socioId) {
    socioId = crypto.randomUUID();
    await sqlite.execute(
      `INSERT INTO socios (id, nome, cpf, email, telefone, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        socioId,
        dados.nome.trim(),
        dados.cpf,
        dados.email?.trim() || null,
        dados.telefone?.trim() || null,
        ts,
        ts,
      ]
    );
  }

  await sqlite.execute(
    `INSERT INTO empresa_socios
       (id, empresa_id, socio_id, participacao_centesimos, is_administrador,
        pro_labore_cents, recebe_distribuicao, data_entrada, data_saida,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      empresaId,
      socioId,
      dados.participacaoCentesimos,
      dados.isAdministrador ? 1 : 0,
      dados.proLaboreCents,
      dados.recebeDistribuicao ? 1 : 0,
      dados.dataEntrada,
      dados.dataSaida,
      ts,
      ts,
    ]
  );
}

/** Edita o cadastro do sócio (global) e os dados do vínculo com a empresa. */
export async function editarSocio(
  vinculoId: string,
  socioId: string,
  dados: DadosSocioVinculo
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  await sqlite.execute(
    `UPDATE socios SET nome = ?, cpf = ?, email = ?, telefone = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.nome.trim(),
      dados.cpf,
      dados.email?.trim() || null,
      dados.telefone?.trim() || null,
      ts,
      socioId,
    ]
  );
  await sqlite.execute(
    `UPDATE empresa_socios
        SET participacao_centesimos = ?, is_administrador = ?, pro_labore_cents = ?,
            recebe_distribuicao = ?, data_entrada = ?, data_saida = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.participacaoCentesimos,
      dados.isAdministrador ? 1 : 0,
      dados.proLaboreCents,
      dados.recebeDistribuicao ? 1 : 0,
      dados.dataEntrada,
      dados.dataSaida,
      ts,
      vinculoId,
    ]
  );
}

/**
 * Remove o vínculo do sócio com a empresa. Se o sócio não participa de mais
 * nenhuma empresa, o cadastro global dele também é removido.
 */
export async function removerSocio(
  vinculoId: string,
  socioId: string
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM empresa_socios WHERE id = ?`, [vinculoId]);
  const restantes = await sqlite.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM empresa_socios WHERE socio_id = ?`,
    [socioId]
  );
  if (restantes[0].n === 0) {
    await sqlite.execute(`DELETE FROM socios WHERE id = ?`, [socioId]);
  }
}
