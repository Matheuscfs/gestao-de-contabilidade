/// Módulo IA — provedores BYOK (Anthropic, OpenAI, Google, OpenRouter).
///
/// Princípio P8: a IA é a voz, não a calculadora.
/// Ela narra fatos já calculados localmente — nunca produz números.
///
/// A chave de API fica no banco local (coluna ai_key_ref da tabela integrations).
/// O Rust faz a verificação e a listagem de modelos junto ao provedor.
/// A UI recebe apenas o status e a lista de modelos disponíveis.
///
/// Comandos IPC (commands/ai.rs):
///   - ai_verificar_chave   → valida a chave e devolve os modelos disponíveis
///   - ai_obter_integracao  → estado atual (provedor, modelo, modelos salvos)
///   - ai_salvar_integracao → grava provedor + chave + modelo escolhido
///   - ai_atualizar_modelo  → troca só o modelo, sem mexer na chave
///   - ai_remover_integracao
///   - ai_conversar         → manda a conversa ao modelo e devolve a resposta
///
/// Módulos:
///   - providers → abstração de provedor + verificação de chave/listagem de modelos
///   - chat      → motor de inferência (envia a conversa, devolve o texto)
///   - contexto  → resumo financeiro compacto, respeitando as permissões

pub mod chat;
pub mod contexto;
pub mod providers;
