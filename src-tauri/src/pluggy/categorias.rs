//! De-para entre a taxonomia de categorias da Pluggy e as categorias do Gestão de Contabilidade.
//!
//! A Pluggy classifica cada transação com um código hierárquico de 8 dígitos
//! (`categoryId`), onde os 2 primeiros dígitos são a categoria de topo e os
//! seguintes refinam: `19000000` Transportation → `19050000` Automotive →
//! `19050001` Gas stations.
//!
//! O mapeamento abaixo casa pelo **prefixo mais específico** disponível, caindo
//! para a categoria de topo quando a sub-categoria não tem destino próprio.
//! Assim, um código novo que a Pluggy venha a criar (ex.: `19050007`) continua
//! caindo em "Transporte" em vez de ficar sem categoria.
//!
//! Os nomes retornados precisam bater exatamente com os de `CATEGORIAS_PADRAO`
//! em `src/core/db/seed.ts` — a resolução nome → id acontece no sync.

/// Prefixos ordenados do mais específico para o mais genérico.
/// A busca devolve o primeiro cujo código comece com o prefixo, então a ordem
/// importa: sub-categorias precisam vir antes da sua categoria de topo.
const MAPA: &[(&str, &str)] = &[
    // ── 01 Income ────────────────────────────────────────────────────────────
    ("01010000", "Salário"),
    ("01", "Renda extra"),
    // ── 02 Loans and financing ───────────────────────────────────────────────
    ("020100", "Impostos & Taxas"), // multa e juros de mora
    ("020200", "Impostos & Taxas"), // juros cobrados
    ("02", "Empréstimos & Financiamentos"),
    // ── 03 Investments ───────────────────────────────────────────────────────
    ("03", "Investimentos"),
    // ── 05 Transfers ─────────────────────────────────────────────────────────
    // Transferência a terceiros (PIX, TED, boleto) é entrada/saída real de
    // dinheiro, mas a finalidade é desconhecida. Ganha categoria própria em vez
    // de cair em "Outros": num extrato real isso é ~18% dos lançamentos, e
    // misturá-los com o resto torna "Outros" o maior grupo do app sem dizer nada.
    // Os códigos de movimentação entre contas próprias não chegam aqui: viram
    // `TRANSFER` (ver `e_movimentacao_interna`) e ficam sem categoria.
    ("05", "Transferências"),
    // ── 06 Legal obligations ─────────────────────────────────────────────────
    ("06", "Impostos & Taxas"),
    // ── 07 Services ──────────────────────────────────────────────────────────
    ("070100", "Telefone & Internet"),
    ("070200", "Educação"),
    ("070300", "Beleza & Cuidados"), // wellness and fitness
    ("070400", "Lazer"),             // ingressos, cinema, museus
    ("07", "Outros"),
    // ── 08 Shopping ──────────────────────────────────────────────────────────
    ("08030000", "Pets"),
    ("08040000", "Vestuário"),
    ("08050000", "Lazer"), // brinquedos
    ("08060000", "Lazer"), // livraria
    ("08070000", "Lazer"), // artigos esportivos
    ("08090000", "Reembolsos"), // cashback entra como receita
    ("08", "Outros"),
    // ── 09 Digital services ──────────────────────────────────────────────────
    ("09", "Assinaturas"),
    // ── 10/11 Alimentação ────────────────────────────────────────────────────
    ("10", "Mercado"),
    ("11", "Alimentação"),
    // ── 12 Travel ────────────────────────────────────────────────────────────
    ("12", "Lazer"),
    // ── 13/14 ────────────────────────────────────────────────────────────────
    ("13", "Outros"), // doações
    ("14", "Lazer"),  // apostas
    // ── 15/16 Encargos ───────────────────────────────────────────────────────
    ("15", "Impostos & Taxas"),
    ("16", "Impostos & Taxas"),
    // ── 17 Housing ───────────────────────────────────────────────────────────
    ("170200", "Contas"), // água, luz, gás
    ("17", "Moradia"),
    // ── 18 Healthcare ────────────────────────────────────────────────────────
    ("18", "Saúde"),
    // ── 19 Transportation ────────────────────────────────────────────────────
    ("19050001", "Combustível"),
    ("19", "Transporte"),
    // ── 20/21 ────────────────────────────────────────────────────────────────
    ("20", "Contas"), // seguros
    ("21", "Lazer"),
    // ── 99 Other ─────────────────────────────────────────────────────────────
    ("99", "Outros"),
];

/// Resolve o nome da categoria Gestão de Contabilidade a partir do `categoryId` da Pluggy.
/// Retorna `None` quando a Pluggy não classificou a transação — nesse caso o
/// sync deixa `category_id` nulo em vez de chutar uma categoria errada.
pub fn categoria_quibo(codigo: Option<&str>) -> Option<&'static str> {
    let codigo = codigo?.trim();
    if codigo.is_empty() {
        return None;
    }

    MAPA.iter()
        .find(|(prefixo, _)| codigo.starts_with(prefixo))
        .map(|(_, nome)| *nome)
}

/// Indica se o código é movimentação entre contas do próprio usuário —
/// `04*` (Same person transfer, em qualquer canal) e `05100000`
/// (Credit card payment, o pagamento da própria fatura).
///
/// Esse dinheiro não entrou nem saiu do patrimônio: só mudou de lugar. Tratá-lo
/// como despesa inflaria o total do mês e, no caso do pagamento de fatura,
/// contaria a mesma compra duas vezes (uma na fatura, outra no pagamento).
/// Por isso essas transações viram `TRANSFER`, que o app soma como neutro.
///
/// `05060000` (Transfer - Internal) fica **de fora** de propósito: "internal"
/// na Pluggy descreve o canal (mesma instituição), não a titularidade — pode
/// perfeitamente ser transferência para terceiros.
pub fn e_movimentacao_interna(codigo: Option<&str>) -> bool {
    let Some(codigo) = codigo.map(str::trim) else {
        return false;
    };
    codigo.starts_with("04") || codigo.starts_with("05100000")
}

#[cfg(test)]
mod testes {
    use super::categoria_quibo;

    #[test]
    fn sub_categoria_vence_a_categoria_de_topo() {
        // 19 sozinho é Transporte, mas o posto de combustível tem destino próprio.
        assert_eq!(categoria_quibo(Some("19010000")), Some("Transporte"));
        assert_eq!(categoria_quibo(Some("19050001")), Some("Combustível"));
        assert_eq!(categoria_quibo(Some("01010000")), Some("Salário"));
        assert_eq!(categoria_quibo(Some("01050000")), Some("Renda extra"));
        assert_eq!(categoria_quibo(Some("020200")), Some("Impostos & Taxas"));
        assert_eq!(categoria_quibo(Some("02040000")), Some("Empréstimos & Financiamentos"));
    }

    #[test]
    fn codigo_desconhecido_cai_na_categoria_de_topo() {
        // Código que a Pluggy ainda não tinha quando o mapa foi escrito.
        assert_eq!(categoria_quibo(Some("19050099")), Some("Transporte"));
        assert_eq!(categoria_quibo(Some("11990000")), Some("Alimentação"));
    }

    #[test]
    fn sem_classificacao_nao_inventa_categoria() {
        assert_eq!(categoria_quibo(None), None);
        assert_eq!(categoria_quibo(Some("")), None);
        assert_eq!(categoria_quibo(Some("   ")), None);
    }

    #[test]
    fn movimentacao_interna_reconhece_conta_propria_e_fatura() {
        use super::e_movimentacao_interna;

        assert!(e_movimentacao_interna(Some("04000000"))); // same person transfer
        assert!(e_movimentacao_interna(Some("04020000"))); // same person - PIX
        assert!(e_movimentacao_interna(Some("05100000"))); // pagamento de fatura

        // Transferência a terceiros é saída real de dinheiro.
        assert!(!e_movimentacao_interna(Some("05070000"))); // PIX a terceiro
        assert!(!e_movimentacao_interna(Some("05060000"))); // canal interno, não titularidade
        assert!(!e_movimentacao_interna(Some("10000000")));
        assert!(!e_movimentacao_interna(None));
    }

    /// Códigos efetivamente observados num extrato real de dois bancos
    /// (~510 transações). Serve de rede de segurança: se alguém mexer no MAPA e
    /// deixar de cobrir um código comum, as transações voltariam a entrar sem
    /// categoria — que era exatamente o bug original.
    const CODIGOS_REAIS: &[&str] = &[
        "19010000", "04000000", "09000000", "05000000", "10000000", "11010000",
        "05070000", "08040000", "19050001", "05100000", "05060000", "08000000",
        "02000000", "15030000", "18020000", "07030000", "07000000", "08070000",
        "02010000", "08060000", "02020000", "07010001", "11020000", "08010000",
        "08020000", "16000000", "19050005", "18040000", "07010000", "19020000",
        "07020000", "17030000", "14000000", "02040000", "19050002", "12020000",
        "07040000",
    ];

    #[test]
    fn nenhum_codigo_real_fica_sem_destino() {
        use super::e_movimentacao_interna;

        for codigo in CODIGOS_REAIS {
            assert!(
                categoria_quibo(Some(codigo)).is_some() || e_movimentacao_interna(Some(codigo)),
                "código {codigo}, presente em extrato real, ficaria sem categoria"
            );
        }
    }

    #[test]
    fn codigos_reais_caem_na_categoria_esperada() {
        // Amostra representativa dos maiores volumes do extrato real.
        assert_eq!(categoria_quibo(Some("19010000")), Some("Transporte"));   // Uber/99
        assert_eq!(categoria_quibo(Some("09000000")), Some("Assinaturas"));  // serviços digitais
        assert_eq!(categoria_quibo(Some("10000000")), Some("Mercado"));
        assert_eq!(categoria_quibo(Some("11010000")), Some("Alimentação"));  // restaurantes
        assert_eq!(categoria_quibo(Some("08040000")), Some("Vestuário"));
        assert_eq!(categoria_quibo(Some("19050001")), Some("Combustível"));
        assert_eq!(categoria_quibo(Some("18020000")), Some("Saúde"));        // farmácia
        assert_eq!(categoria_quibo(Some("07010001")), Some("Telefone & Internet"));
        assert_eq!(categoria_quibo(Some("15030000")), Some("Impostos & Taxas")); // IOF
    }

    #[test]
    fn cobre_todas_as_categorias_de_topo_da_pluggy() {
        use super::e_movimentacao_interna;

        // As 22 categorias de topo do catálogo /categories precisam ter destino:
        // ou uma categoria do Gestão de Contabilidade, ou o tratamento de movimentação interna
        // (04 Same person transfer, que fica sem categoria de propósito).
        for topo in [
            "01000000", "02000000", "03000000", "04000000", "05000000", "06000000",
            "07000000", "08000000", "09000000", "10000000", "11000000", "12000000",
            "13000000", "14000000", "15000000", "16000000", "17000000", "18000000",
            "19000000", "20000000", "21000000", "99999999",
        ] {
            assert!(
                categoria_quibo(Some(topo)).is_some() || e_movimentacao_interna(Some(topo)),
                "categoria de topo {topo} ficou sem destino"
            );
        }
    }
}
