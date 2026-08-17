/**
 * Confere o anexo do Simples e o Fator R de cada empresa contra o CNAE
 * cadastrado, e aplica as correções.
 *
 *   npx vite-node scripts/aplicar-enquadramento.ts -- --dry-run
 *   npx vite-node scripts/aplicar-enquadramento.ts
 *
 * Não usa rede: lê o CNAE que já está no banco (posto lá por
 * `consultar-cnpjs.ts` ou digitado à mão) e passa pelo mesmo
 * `classificarCnae` que o app usa. Ou seja, o resultado aqui é igual ao do
 * botão "Aplicar enquadramento" na tela — só que nas 24 de uma vez.
 *
 * Duas regras que o relatório de consulta não cobria:
 *
 *   • Divergência não é só a letra do anexo. Empresa pode estar no Anexo III
 *     certo e com o **Fator R ligado indevidamente** — é o caso de curso livre
 *     e escritório contábil, que são Anexo III por atividade (§5º-B). O
 *     sintoma é o app mandar migrar para o Anexo V sem que a lei mande.
 *   • CNAE que o classificador não reconhece **não vira nada**. Sem sugestão
 *     confiável, quem decide é o contador na tela.
 *
 * Mexe só em empresa do Simples: anexo e Fator R não existem fora dele.
 *
 * Flags:
 *   --dry-run          relata as divergências sem gravar
 *   --banco=<caminho>  quibo.db alvo (padrão: pasta de dados do app)
 */

import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { classificarCnae } from "@/consts/cnae";

const flags = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
  if (m) flags.set(m[1], m[2] ?? "true");
}
const DRY_RUN = flags.has("dry-run");

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

type Row = {
  id: string;
  razao_social: string;
  anexo_simples: string | null;
  sujeito_fator_r: number;
  cnae_principal: string | null;
  cnae_descricao: string | null;
};

const caminho = flags.get("banco") ?? caminhoBancoPadrao();
console.log(`Banco: ${caminho}`);
if (DRY_RUN) console.log("Modo --dry-run: nada será gravado.\n");

const db = new DatabaseSync(caminho);
db.exec("PRAGMA busy_timeout = 5000");

const empresas = db
  .prepare(
    `SELECT id, razao_social, anexo_simples, sujeito_fator_r, cnae_principal, cnae_descricao
       FROM empresas
      WHERE archived = 0 AND regime_tributario = 'SIMPLES'
      ORDER BY razao_social COLLATE NOCASE ASC`
  )
  .all() as unknown as Row[];

const semCnae: string[] = [];
const naoClassificados: string[] = [];
const conferem: string[] = [];
const corrigir: {
  row: Row;
  anexo: string;
  fatorR: boolean;
  motivo: string[];
  fundamento: string;
}[] = [];

for (const e of empresas) {
  if (!e.cnae_principal) {
    semCnae.push(e.razao_social);
    continue;
  }
  const enq = classificarCnae(e.cnae_principal);
  if (!enq) {
    naoClassificados.push(`${e.razao_social} — CNAE ${e.cnae_principal} (${e.cnae_descricao ?? "sem descrição"})`);
    continue;
  }

  const fatorRAtual = e.sujeito_fator_r === 1;
  const motivo: string[] = [];

  // O anexo do Fator R oscila entre III e V por desenho da lei: quem está no V
  // com atividade do §5º-D não está errado, está com folha abaixo de 28%.
  const anexoOk =
    e.anexo_simples === enq.anexoSugerido ||
    (enq.sujeitoFatorR &&
      (e.anexo_simples === "III" || e.anexo_simples === "V"));

  if (!anexoOk) {
    motivo.push(
      `anexo ${e.anexo_simples ?? "(vazio)"} → ${enq.anexoSugerido}`
    );
  }
  if (fatorRAtual !== enq.sujeitoFatorR) {
    motivo.push(`Fator R ${fatorRAtual ? "ligado" : "desligado"} → ${enq.sujeitoFatorR ? "ligado" : "desligado"}`);
  }

  if (motivo.length === 0) {
    conferem.push(e.razao_social);
    continue;
  }

  corrigir.push({
    row: e,
    // Anexo só muda quando de fato diverge; senão preserva o III/V escolhido
    // pela folha, que é decisão do contador e não do CNAE.
    anexo: anexoOk ? (e.anexo_simples as string) : enq.anexoSugerido,
    fatorR: enq.sujeitoFatorR,
    motivo,
    fundamento: enq.fundamento,
  });
}

console.log(`${empresas.length} empresa(s) no Simples.\n`);

if (corrigir.length > 0) {
  console.log(`Divergências (${corrigir.length}):`);
  for (const c of corrigir) {
    console.log(`  · ${c.row.razao_social}`);
    console.log(`      ${c.row.cnae_principal} — ${c.row.cnae_descricao ?? ""}`);
    console.log(`      ${c.motivo.join("; ")}`);
    console.log(`      ${c.fundamento}`);
  }
}

if (!DRY_RUN) {
  const upd = db.prepare(
    `UPDATE empresas SET anexo_simples = ?, sujeito_fator_r = ?, updated_at = ? WHERE id = ?`
  );
  const ts = new Date().toISOString();
  for (const c of corrigir) upd.run(c.anexo, c.fatorR ? 1 : 0, ts, c.row.id);
}

const secao = (titulo: string, itens: string[]) => {
  if (itens.length === 0) return;
  console.log(`\n${titulo} (${itens.length}):`);
  for (const i of itens) console.log(`  · ${i}`);
};

secao("Já conferem com o CNAE", conferem);
secao("CNAE não classificado — decidir na tela", naoClassificados);
secao("Sem CNAE cadastrado", semCnae);

console.log(
  `\n${"─".repeat(60)}\n${corrigir.length} empresa(s) ${
    DRY_RUN ? "seriam corrigidas" : "corrigidas"
  }.`
);

db.close();
