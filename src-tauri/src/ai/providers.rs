#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum Provider {
    OpenAI,
    Anthropic,
    Ollama,
}

impl Provider {
    pub fn service_name(&self) -> &'static str {
        match self {
            Provider::OpenAI => "ai_openai",
            Provider::Anthropic => "ai_anthropic",
            Provider::Ollama => "ai_ollama",
        }
    }

    pub fn base_url(&self) -> &'static str {
        match self {
            Provider::OpenAI => "https://api.openai.com/v1",
            Provider::Anthropic => "https://api.anthropic.com/v1",
            Provider::Ollama => "http://localhost:11434/v1",
        }
    }
}
