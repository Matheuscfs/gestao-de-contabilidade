import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VinculoFuncionario =
  | "CLT"
  | "ESTAGIO"
  | "APRENDIZ"
  | "TEMPORARIO"
  | "OUTRO";

export const LABEL_VINCULO: Record<VinculoFuncionario, string> = {
  CLT: "CLT",
  ESTAGIO: "Estágio",
  APRENDIZ: "Aprendiz",
  TEMPORARIO: "Temporário",
  OUTRO: "Outro",
};

export type Funcionario = {
  id: string;
  empresaId: string;
  nome: string;
  /** Só dígitos (11) ou null. */
  cpf: string | null;
  cargo: string | null;
  vinculo: VinculoFuncionario;
  salarioCents: number;
  dataAdmissao: string | null;
  /** Preenchida = desligado. */
  dataDemissao: string | null;
};

export type DadosFuncionario = Omit<Funcionario, "id" | "empresaId">;

type FuncionarioRow = {
  id: string;
  empresa_id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  vinculo: string;
  salario_cents: number;
  data_admissao: string | null;
  data_demissao: string | null;
};

function mapearLinha(r: FuncionarioRow): Funcionario {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    nome: r.nome,
    cpf: r.cpf ?? null,
    cargo: r.cargo ?? null,
    vinculo: r.vinculo as VinculoFuncionario,
    salarioCents: r.salario_cents,
    dataAdmissao: r.data_admissao ?? null,
    dataDemissao: r.data_demissao ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarFuncionarios(
  empresaId: string
): Promise<Funcionario[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<FuncionarioRow[]>(
    `SELECT id, empresa_id, nome, cpf, cargo, vinculo, salario_cents,
            data_admissao, data_demissao
       FROM funcionarios
      WHERE empresa_id = ? AND archived = 0
      ORDER BY data_demissao IS NOT NULL ASC, nome COLLATE NOCASE ASC`,
    [empresaId]
  );
  return rows.map(mapearLinha);
}

export async function criarFuncionario(
  empresaId: string,
  dados: DadosFuncionario
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO funcionarios
       (id, empresa_id, nome, cpf, cargo, vinculo, salario_cents,
        data_admissao, data_demissao, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      crypto.randomUUID(),
      empresaId,
      dados.nome.trim(),
      dados.cpf,
      dados.cargo?.trim() || null,
      dados.vinculo,
      dados.salarioCents,
      dados.dataAdmissao,
      dados.dataDemissao,
      ts,
      ts,
    ]
  );
  // Cadastrar um funcionário implica que a empresa tem funcionários — a flag
  // alimenta o motor de obrigações (eSocial, FGTS Digital etc.).
  await sqlite.execute(
    `UPDATE empresas SET tem_funcionarios = 1, updated_at = ? WHERE id = ?`,
    [ts, empresaId]
  );
}

export async function editarFuncionario(
  id: string,
  dados: DadosFuncionario
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE funcionarios
        SET nome = ?, cpf = ?, cargo = ?, vinculo = ?, salario_cents = ?,
            data_admissao = ?, data_demissao = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.nome.trim(),
      dados.cpf,
      dados.cargo?.trim() || null,
      dados.vinculo,
      dados.salarioCents,
      dados.dataAdmissao,
      dados.dataDemissao,
      agora(),
      id,
    ]
  );
}

export async function excluirFuncionario(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM funcionarios WHERE id = ?`, [id]);
}
