-- Módulo contábil — Fase 9: ISS por município e presunção reduzida.
--
-- O catálogo de obrigações fixava o vencimento do ISS no dia 10 para todo
-- mundo. ISS é imposto municipal: prazo e alíquota mudam de cidade para
-- cidade, e a carteira já tem empresas em Cascavel, Toledo, Nova Santa Rosa e
-- São Paulo — quatro calendários tratados como um só.

-- Dia do vencimento do ISS no município da empresa. Continua caindo no dia 10
-- por padrão, que é o mais comum, mas agora é ajustável.
ALTER TABLE empresas ADD COLUMN iss_dia_vencimento INTEGER NOT NULL DEFAULT 10;

-- Alíquota do ISS em centésimos de % (200 = 2%, 500 = 5%). Zero = não informada.
-- A faixa legal vai de 2% a 5% (CF art. 156 §3º e LC 116).
ALTER TABLE empresas ADD COLUMN iss_aliquota_centesimos INTEGER NOT NULL DEFAULT 0;

-- Sociedade de profissão regulamentada (advocacia, medicina, engenharia,
-- contabilidade…). No Lucro Presumido isso impede a presunção reduzida de 16%
-- do IRPJ para serviços, mesmo com receita anual abaixo de R$ 120.000.
ALTER TABLE empresas ADD COLUMN profissao_regulamentada INTEGER NOT NULL DEFAULT 0;
