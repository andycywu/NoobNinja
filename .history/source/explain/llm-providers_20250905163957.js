/**
 * LLM Providers - 支援多種 LLM 服務提供者
 * 包括本地 Ollama 和 OpenAI API
 */

/**
 * Ollama 本地 LLM 提供者
 */
class OllamaProvider {
    constructor() {
        this.baseUrl = 'http://localhost:11434';
        // 使用較小的本地模型預設，且可透過 configure 覆寫
        this.model = 'gemma3:1b';
        this.timeout = 30000;
    }

    configure(config) {
        this.baseUrl = config.baseUrl || this.baseUrl;
        this.model = config.model || this.model;
        this.timeout = config.timeout || this.timeout;
    }

    getDisplayName() {
        return 'Ollama (本地)';
    }

    getDescription() {
        return '本地運行的 Ollama LLM 服務';
    }

    async isAvailable() {
        try {
            /* eslint-disable no-console */
            console.log('[Ollama Debug] 檢查 Ollama 可用性...', this.baseUrl);
            /* eslint-enable no-console */

            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            /* eslint-disable no-console */
            console.log('[Ollama Debug] 連線回應狀態:', response.ok, response.status);
            /* eslint-enable no-console */

            return response.ok;
        } catch (error) {
            /* eslint-disable no-console */
            console.error('[Ollama Debug] 連線失敗:', error.message);
            /* eslint-enable no-console */
            return false;
        }
    }

    async generate(prompt, options = {}) {
        /* eslint-disable no-console */
        console.log('[Ollama Debug] 開始生成回應...', {
            model: options.model || this.model,
            promptLength: prompt.length,
            baseUrl: this.baseUrl
        });
        /* eslint-enable no-console */

        // debug: 檢查 prompt 是否包含關鍵欄位
        try {
            const parsed = JSON.parse(prompt);
            console.log('[Ollama Debug] prompt contains keys:', Object.keys(parsed));
        } catch (e) {
            // prompt 不是純 JSON：嘗試搜尋關鍵字
            console.log('[Ollama Debug] prompt length:', prompt.length, 'contains metadata:', prompt.indexOf('"metadata"') !== -1, 'usage:', prompt.indexOf('usage') !== -1, 'application:', prompt.indexOf('application') !== -1);
        }

        const requestBody = {
            model: options.model || this.model,
            prompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                top_p: options.topP || 0.9,
                max_tokens: options.maxTokens || 2048
            }
        };

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            /* eslint-disable no-console */
            console.log('[Ollama Debug] 生成請求回應:', response.status, response.ok);
            /* eslint-enable no-console */

            if (!response.ok) {
                throw new Error(`Ollama API 錯誤: ${response.status}`);
            }

            const data = await response.json();

            /* eslint-disable no-console */
            console.log('[Ollama Debug] 生成完成:', {
                responseLength: data.response ? data.response.length : 0,
                hasResponse: Boolean(data.response)
            });
            /* eslint-enable no-console */

            return data.response || '';
        } catch (error) {
            /* eslint-disable no-console */
            console.error('[Ollama Debug] 生成失敗:', error.message);
            /* eslint-enable no-console */
            throw new Error(`Ollama 請求失敗: ${error.message}`);
        }
    }

    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) {
                throw new Error(`無法獲取模型列表: ${response.status}`);
            }

            const data = await response.json();
            return data.models || [];
        } catch (error) {
            throw new Error(`獲取 Ollama 模型列表失敗: ${error.message}`);
        }
    }
}

/**
 * OpenAI API 提供者
 */
class OpenAIProvider {
    constructor() {
        this.apiKey = '';
        this.baseUrl = 'https://api.openai.com/v1';
        this.model = 'gpt-3.5-turbo';
        this.timeout = 30000;
    }

    configure(config) {
        this.apiKey = config.apiKey || this.apiKey;
        this.baseUrl = config.baseUrl || this.baseUrl;
        this.model = config.model || this.model;
        this.timeout = config.timeout || this.timeout;
    }

    getDisplayName() {
        return 'OpenAI';
    }

    getDescription() {
        return 'OpenAI GPT 模型服務';
    }

    async isAvailable() {
        if (!this.apiKey) {
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                signal: AbortSignal.timeout(5000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async generate(prompt, options = {}) {
        if (!this.apiKey) {
            throw new Error('請設定 OpenAI API Key');
        }

        const requestBody = {
            model: options.model || this.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature || 0.7,
            top_p: options.topP || 0.9,
            max_tokens: options.maxTokens || 2048
        };

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API 錯誤: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            throw new Error(`OpenAI 請求失敗: ${error.message}`);
        }
    }

    async listModels() {
        if (!this.apiKey) {
            throw new Error('請設定 OpenAI API Key');
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`無法獲取模型列表: ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            throw new Error(`獲取 OpenAI 模型列表失敗: ${error.message}`);
        }
    }
}

export class LLMProviders {
    constructor() {
        this.providers = {
            ollama: new OllamaProvider(),
            openai: new OpenAIProvider()
        };
        this.currentProvider = 'ollama';
    }

    /**
     * 設定當前使用的 LLM 提供者
     * @param {string} providerName - 提供者名稱
     * @param {Object} config - 配置選項
     */
    setProvider(providerName, config = {}) {
        if (!this.providers[providerName]) {
            throw new Error(`不支援的 LLM 提供者: ${providerName}`);
        }

        this.currentProvider = providerName;
        this.providers[providerName].configure(config);
    }

    /**
     * 獲取當前提供者
     * @returns {Object} LLM 提供者實例
     */
    getCurrentProvider() {
        return this.providers[this.currentProvider];
    }

    /**
     * 生成模型解釋
     * @param {string} prompt - 提示詞
     * @param {Object} options - 生成選項
     * @returns {Promise<string>} 生成的解釋文字
     */
    async generateExplanation(prompt, options = {}) {
        const provider = this.getCurrentProvider();
        return await provider.generate(prompt, options);
    }

    /**
     * 檢查提供者是否可用
     * @param {string} providerName - 提供者名稱
     * @returns {Promise<boolean>} 是否可用
     */
    async checkAvailability(providerName) {
        const provider = this.providers[providerName];
        if (!provider) {
            return false;
        }
        return await provider.isAvailable();
    }

    /**
     * 獲取所有可用的提供者
     * @returns {Promise<Array>} 可用提供者列表
     */
    async getAvailableProviders() {
        const available = [];
        const checks = Object.entries(this.providers).map(async ([name, provider]) => {
            const isAvailable = await provider.isAvailable();
            if (isAvailable) {
                return {
                    name,
                    displayName: provider.getDisplayName(),
                    description: provider.getDescription()
                };
            }
            return null;
        });

        const results = await Promise.all(checks);
        available.push(...results.filter((result) => result !== null));
        return available;
    }
}
