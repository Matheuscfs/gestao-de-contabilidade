/**
 * Consulta na Receita (BrasilAPI) o CNPJ de todas as empresas cadastradas e
 * preenche o que está em branco.
 *
 *   npx vite-node scripts/consultar-cnpjs.ts -- --dry-run
 *   npx vite-node scripts/consultar-cnpjs.ts
 *
 * Existe porque o app consulta uma empresa por vez, pelo modal — e a carteira
 * tem 24 clientes, nenhum com CNAE. Roda sob `vite-node` para reusar o
 * classificador de `@/consts/cnae` e o mapeamento de `@/core/ipc/cnpj` em vez
 * de reimplementar as regras aqui; o alias `@` vem do vite.config.ts.
 *
 * Regras de escrita, iguais às do botão no app:
 *   - **só preenche campo vazio.** O cadastro do escritório costuma estar mais
 *     atualizado que o dump da Receita, que é mensal. `--sobrescrever` inverte
 *     isso, e aí só para os campos factuais (nunca regime, anexo ou Fator R).
 *   - **enquadramento não é aplicado automaticamente.** Anexo e Fator R mudam o
 *     imposto; o script só relata a sugestão para o usuário conferir na tela.
 *   - CNAE fora das listas da LC 123 fica sem sugestão em vez de receber chute.
 *
 * Flags:
 *   --dry-run         consulta e relata, sem gravar nada
 *   --sobrescrever    substitui campos factuais já preenchidos (CNAE, município…)
 *   --banco=<caminho> quibo.db alvo (padrão: pasta de dados do app)
 *   --intervalo=<ms>  espera entre consultas (padrão 2000)
 *   --cnpj=<digitos>  consulta só esta empresa (útil para testar)
 */

import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { interpretarRespostaCnpj, type DadosCnpj } from "@/core/ipc/cnpj";

// ─── Flags ────────────────────────────────────────────────────────────────────

const flags = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
  if (m) flags.set(m[1], m[2] ?? "true");
}

const DRY_RUN = flags.has("dry-run");
const SOBRESCREVER = flags.has("sobrescrever");
const INTERVALO_MS = Number(flags.get("intervalo") ?? 2000);

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

// ─── Consulta ─────────────────────────────────────────────────────────────────

// `<serviço>/<versão>` — ver a nota em src-tauri/src/commands/cnpj.rs.
const BASE_URL = "https://brasilapi.com.br/api/cnpj/v1";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uma consulta, com repetição no 429.
 *
 * A BrasilAPI limita por IP e 24 CNPJs seguidos batem no teto com facilidade.
 * Desistir na primeira negativa deixaria metade da carteira sem CNAE e exigiria
 * descobrir na mão quais faltaram.
 */
async function consultar(cnpj: string, tentativa = 1): Promise<DadosCnpj> {
  const resp = await fetch(`${BASE_URL}/${cnpj}`, {
    // Sem User-Agent a borda da BrasilAPI devolve 403 — o `fetch` do Node não
    // manda nenhum. Ver a nota em src-tauri/src/commands/cnpj.rs.
    headers: {
      Accept: "application/json",
      "User-Agent": "gestao-contabilidade/0.1",
    },
  });

  if (resp.status === 429 && tentativa <= 4) {
    const espera_s = 15 * tentativa;
    console.log(`    limite da API atingido — nova tentativa em ${espera_s}s`);
    await espera(espera_s * 1000);
    return consultar(cnpj, tentativa + 1);
  }
  if (resp.status === 404) throw new Error("não encontrado na base da Receita");
  if (!resp.ok) throw new Error(`a BrasilAPI respondeu ${resp.status}`);

  return interpretarRespostaCnpj(await resp.text());
}

// ─── Aplicação no banco ───────────────────────────────────────────────────────

type EmpresaRow = {
  id: string;
  razao_social: string;
  cnpj: string;
  data_abertura: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  uf: string | null;
  municipio: string | null;
  telefone: string | null;
  email: string | null;
  capital_social_cents: number;
  anexo_simples: string | null;
  regime_tributario: string;
};

const vazio = (v: string | null) => v === null || v.trim() === "";

/**
 * Monta o UPDATE só com o que muda. Devolve os rótulos do que foi tocado para
 * o relatório — dizer "3 empresas atualizadas" sem dizer o quê não permite
 * conferir nada.
 */
function montarAtualizacao(
  atual: EmpresaRow,
  d: DadosCnpj
): { sets: string[]; valores: unknown[]; tocados: string[] } {
  const sets: string[] = [];
  const valores: unknown[] = [];
  const tocados: string[] = [];

  const texto = (
    coluna: string,
    rotulo: string,
    valorAtual: string | null,
    novo: string | null
  ) => {
    if (!novo) return;
    if (!vazio(valorAtual) && !SOBRESCREVER) return;
    if (valorAtual === novo) return;
    sets.push(`${coluna} = ?`);
    valores.push(novo);
    tocados.push(rotulo);
  };

  texto("data_abertura", "abertura", atual.data_abertura, d.dataAbertura);
  texto("cnae_principal", "CNAE", atual.cnae_principal, d.cnaePrincipal);
  texto("cnae_descricao", "descrição do CNAE", atual.cnae_descricao, d.cnaeDescricao);
  texto("uf", "UF", atual.uf, d.uf);
  texto("municipio", "município", atual.municipio, d.municipio);
  texto("telefone", "telefone", atual.telefone, d.telefone);
  texto("email", "e-mail", atual.email, d.email);
  texto(
    "cnaes_secundarios",
    "CNAEs secundários",
    null,
    d.cnaesSecundarios.length > 0 ? JSON.stringify(d.cnaesSecundarios) : null
  );

  // Capital social é número: "vazio" aqui é zero, não string em branco.
  if (d.capitalSocialCents > 0 && (SOBRESCREVER || atual.capital_social_cents === 0)) {
    sets.push("capital_social_cents = ?");
    valores.push(d.capitalSocialCents);
    tocados.push("capital social");
  }

  return { sets, valores, tocados };
}

// ─── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  const caminho = flags.get("banco") ?? caminhoBancoPadrao();
  console.log(`Banco: ${caminho}`);
  if (DRY_RUN) console.log("Modo --dry-run: nada será gravado.\n");

  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA busy_timeout = 5000");

  const filtroCnpj = flags.get("cnpj")?.replace(/\D/g, "");
  const empresas = db
    .prepare(
      `SELECT id, razao_social, cnpj, data_abertura, cnae_principal, cnae_descricao,
              uf, municipio, telefone, email, capital_social_cents, anexo_simples,
              regime_tributario
         FROM empresas
        WHERE archived = 0 ${filtroCnpj ? "AND cnpj = ?" : ""}
        ORDER BY razao_social COLLATE NOCASE ASC`
    )
    .all(...(filtroCnpj ? [filtroCnpj] : [])) as unknown as EmpresaRow[];

  console.log(`${empresas.length} empresa(s) a consultar.\n`);

  const sugestoes: string[] = [];
  const naoClassificados: string[] = [];
  const divergencias: string[] = [];
  const falhas: string[] = [];
  let atualizadas = 0;

  for (const [i, e] of empresas.entries()) {
    const rotulo = `[${i + 1}/${empresas.length}] ${e.razao_social}`;
    try {
      const d = await consultar(e.cnpj);
      const { sets, valores, tocados } = montarAtualizacao(e, d);

      if (sets.length > 0) {
        if (!DRY_RUN) {
          db.prepare(
            `UPDATE empresas SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`
          ).run(...(valores as never[]), new Date().toISOString(), e.id);
        }
        atualizadas++;
        console.log(`${rotulo} — ${tocados.join(", ")}`);
      } else {
        console.log(`${rotulo} — já estava completo`);
      }

      // Situação cadastral diferente de ATIVA é a informação mais valiosa da
      // consulta e não cabe num campo: vira aviso no fim.
      if (d.situacaoCadastral && d.situacaoCadastral !== "ATIVA") {
        divergencias.push(`${e.razao_social}: Receita diz ${d.situacaoCadastral}`);
      }

      // Enquadramento nunca é gravado por script — muda imposto.
      if (d.enquadramento) {
        const { anexoSugerido, sujeitoFatorR } = d.enquadramento;
        const conflita =
          e.regime_tributario === "SIMPLES" &&
          e.anexo_simples !== null &&
          e.anexo_simples !== anexoSugerido &&
          !(sujeitoFatorR && (e.anexo_simples === "III" || e.anexo_simples === "V"));
        sugestoes.push(
          `${e.razao_social} → Anexo ${anexoSugerido}${
            sujeitoFatorR ? " (sujeito ao Fator R)" : " (sem Fator R)"
          }${
            e.anexo_simples
              ? conflita
                ? ` — cadastro está no ${e.anexo_simples}, confira`
                : ""
              : " — cadastro sem anexo"
          }`
        );
      } else if (d.cnaePrincipal) {
        naoClassificados.push(`${e.razao_social}: CNAE ${d.cnaePrincipal}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${rotulo} — FALHOU: ${msg}`);
      falhas.push(`${e.razao_social} (${e.cnpj}): ${msg}`);
    }

    if (i < empresas.length - 1) await espera(INTERVALO_MS);
  }

  db.close();

  const secao = (titulo: string, itens: string[]) => {
    if (itens.length === 0) return;
    console.log(`\n${titulo} (${itens.length}):`);
    for (const i of itens) console.log(`  · ${i}`);
  };

  console.log(
    `\n${"─".repeat(60)}\n${atualizadas} de ${empresas.length} empresa(s) ${
      DRY_RUN ? "seriam atualizadas" : "atualizadas"
    }.`
  );
  secao("Enquadramento sugerido pelo CNAE (aplicar na aba Tributos)", sugestoes);
  secao("CNAE fora das listas da LC 123 — decidir na mão", naoClassificados);
  secao("Situação cadastral diferente de ATIVA", divergencias);
  secao("Falhas", falhas);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
