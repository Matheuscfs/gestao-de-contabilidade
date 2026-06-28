/// Módulo IA — provedores BYOK (OpenAI, Anthropic, Ollama).
///
/// Princípio P8: a IA é a voz, não a calculadora.
/// Ela narra fatos já calculados localmente — nunca produz números.
///
/// A API key fica no keychain. O Rust faz a chamada ao provedor.
/// A UI recebe apenas o texto gerado.
///
/// Comandos IPC (a implementar em commands/ai.rs):
///   - ai_complete
///   - ai_test_key
///   - ai_list_providers

pub mod providers;
