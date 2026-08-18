-- Módulo contábil — Fase 10: CNAE vindo da Receita e Fator R por atividade.
--
-- Dois buracos que andavam juntos:
--
-- 1) Nenhuma das 24 empresas da carteira tinha CNAE preenchido, porque a
--    planilha de origem não trazia. Sem CNAE não dá para enquadrar o anexo do
--    Simples nem para escolher o RAT. Agora o CNAE chega da consulta pública
--    da Receita, e guardar a descrição junto evita depender de uma tabela de
--    ~1.300 subclasses só para mostrar o nome da atividade na tela.
--
-- 2) O app tratava "Anexo III" como sinônimo de "passou no Fator R". Não é:
--    a LC 123 art. 18 §5º-B lista serviços que são Anexo III **por atividade**
--    (contabilidade, creche e ensino, agência de viagem, transporte municipal
--    de passageiros, instalação e manutenção, agência lotérica…), onde o Fator
--    R não se aplica. Só o rol do §5º-D é que oscila entre III e V conforme a
--    folha. Sem essa distinção o app avisava "Fator R indica o Anexo V" para
--    quem tem direito ao III por lei — erro que custa a diferença entre 6% e
--    15,5% de alíquota inicial.

-- Descrição do CNAE principal, como a Receita devolve.
ALTER TABLE empresas ADD COLUMN cnae_descricao TEXT;

-- A atividade está sujeita ao teste do Fator R (LC 123 art. 18 §5º-D)?
-- Só faz sentido nos Anexos III e V. O padrão 1 preserva o comportamento
-- anterior: quem já estava cadastrado continua sendo avaliado pelo Fator R até
-- alguém dizer o contrário — desligar sozinho mudaria o enquadramento de
-- empresa existente sem ninguém mandar.
ALTER TABLE empresas ADD COLUMN sujeito_fator_r INTEGER NOT NULL DEFAULT 1;
