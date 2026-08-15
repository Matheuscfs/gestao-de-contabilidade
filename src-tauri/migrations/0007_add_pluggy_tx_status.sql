-- Status da transação como a Pluggy informa: POSTED (liquidada) ou PENDING
-- (autorizada, ainda não consolidada). NULL para lançamentos manuais.
--
-- Existe separado de `transactions.status` porque os dois respondem perguntas
-- diferentes. O `status` do Quibo diz se o dinheiro conta nos totais; numa
-- compra de cartão a resposta é sim mesmo com a fatura aberta, senão o gasto
-- do mês sumiria. Este campo preserva o dado do banco para a UI conseguir
-- marcar "pendente" sem alterar nenhum cálculo.
ALTER TABLE transactions ADD COLUMN pluggy_status TEXT;
