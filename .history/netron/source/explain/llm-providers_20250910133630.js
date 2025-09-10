class OllamaProvider {
    constructor() { this.baseUrl = 'http://localhost:11434'; this.model = 'gemma3:1b'; this.timeout = 30000; }
    configure(config) { this.baseUrl = config.baseUrl || this.baseUrl; this.model = config.model || this.model; this.timeout = config.timeout || this.timeout; }
    getDisplayName() { return 'Ollama (local)'; }
    async isAvailable() { try { const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(5000) }); return response.ok; } catch { return false; } }
    async generate(prompt, options = {}) { const requestBody = { model: options.model || this.model, prompt, stream: false, options: { temperature: options.temperature || 0.7, top_p: options.topP || 0.9, max_tokens: options.maxTokens || 2048 } }; const response = await fetch(`${this.baseUrl}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: AbortSignal.timeout(this.timeout) }); if (!response.ok) throw new Error(`Ollama API error: ${response.status}`); const data = await response.json(); return data.response || ''; }
}

class OpenAIProvider {
    constructor() { this.apiKey = ''; this.baseUrl = 'https://api.openai.com/v1'; this.model = 'gpt-3.5-turbo'; this.timeout = 30000; }
    configure(config) { this.apiKey = config.apiKey || this.apiKey; this.baseUrl = config.baseUrl || this.baseUrl; this.model = config.model || this.model; this.timeout = config.timeout || this.timeout; }
    getDisplayName() { return 'OpenAI'; }
    async isAvailable() { if (!this.apiKey) return false; try { const response = await fetch(`${this.baseUrl}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${this.apiKey}` }, signal: AbortSignal.timeout(5000) }); return response.ok; } catch { return false; } }
    async generate(prompt, options = {}) { if (!this.apiKey) throw new Error('OpenAI API Key required'); const requestBody = { model: options.model || this.model, messages: [{ role: 'user', content: prompt }], temperature: options.temperature || 0.7, top_p: options.topP || 0.9, max_tokens: options.maxTokens || 2048 }; const response = await fetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` }, body: JSON.stringify(requestBody), signal: AbortSignal.timeout(this.timeout) }); if (!response.ok) { const e = await response.json().catch(()=>({})); throw new Error(`OpenAI API error: ${response.status} - ${e.error?.message||'Unknown'}`); } const data = await response.json(); return data.choices?.[0]?.message?.content || ''; }
}

export class LLMProviders {
    constructor() { this.providers = { ollama: new OllamaProvider(), openai: new OpenAIProvider() }; this.currentProvider = 'ollama'; }
    setProvider(providerName, config = {}) { if (!this.providers[providerName]) { throw new Error(`unsupported provider: ${providerName}`); } this.currentProvider = providerName; this.providers[providerName].configure(config); }
    getCurrentProvider() { return this.providers[this.currentProvider]; }
    async generateExplanation(prompt, options = {}) { const provider = this.getCurrentProvider(); return await provider.generate(prompt, options); }
    async getAvailableProviders() { const available = []; const checks = Object.entries(this.providers).map(async ([name, provider]) => { const isAvailable = await provider.isAvailable(); if (isAvailable) return { name, displayName: provider.getDisplayName() }; return null; }); const results = await Promise.all(checks); for (const r of results) if (r) available.push(r); return available; }
}
