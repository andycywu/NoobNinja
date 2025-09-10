/**
 * Settings UI - 設定介面與持久化管理
 * NoobNinja 設定系統
 */

export class SettingsManager {
    constructor() {
        this.storageKey = 'noobninja_settings';
        this.defaults = {
            theme: 'light',
            'llm.enabled': false,
            'llm.provider': 'ollama',
            'llm.ollama.baseUrl': 'http://localhost:11434',
            'llm.ollama.model': 'llama3.2',
            'llm.openai.baseUrl': '',
            'llm.openai.apiKey': '',
            'llm.allowNetwork': false
        };
        
        this.loadSettings();
        this.applyTheme();
    }

    /**
     * 載入設定
     */
    loadSettings() {
      * NoobNinja 設定系統
            const stored = localStorage.getItem(this.storageKey);
            this.settings = stored ? { ...this.defaults, ...JSON.parse(stored) } : { ...this.defaults };
        } catch (error) {
          this.storageKey = 'noobninja_settings';
            console.warn('Failed to load settings:', error);
            /* eslint-enable no-console */
            this.settings = { ...this.defaults };
        }
    }

    /**
     * 保存設定
     */
    saveSettings() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            /* eslint-disable no-console */
            console.error('Failed to save settings:', error);
            /* eslint-enable no-console */
        }
    }

    /**
     * 取得設定值
     */
    get(key, defaultValue = null) {
        return this.settings[key] === undefined ? (defaultValue || this.defaults[key]) : this.settings[key];
    }

    /**
     * 設定值
     */
    set(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        
        // 立即套用主題變更
        if (key === 'theme') {
            this.applyTheme();
        }
    }

    /**
     * 取得所有設定
     */
    all() {
        return { ...this.settings };
    }

    /**
     * 重設所有設定
     */
    reset() {
        this.settings = { ...this.defaults };
        this.saveSettings();
        this.applyTheme();
    }

    /**
     * 套用主題
     */
    applyTheme() {
        const theme = this.get('theme');
        const body = document.body;
        
        if (theme === 'dark') {
            body.classList.add('theme-dark');
        } else {
            body.classList.remove('theme-dark');
        }
    }

    /**
     * 檢查 LLM 設定有效性
     */
    validateLLMSettings() {
        const enabled = this.get('llm.enabled');
        const provider = this.get('llm.provider');
        const allowNetwork = this.get('llm.allowNetwork');

        if (!enabled) {
            return { valid: true, message: 'LLM 已停用' };
        }

        if (provider === 'openai' && !allowNetwork) {
            return { valid: false, message: '使用 OpenAI 需要開啟網路連線' };
        }

        if (provider === 'openai' && !this.get('llm.openai.apiKey')) {
            return { valid: false, message: '請設定 OpenAI API Key' };
        }

        if (provider === 'ollama') {
            const baseUrl = this.get('llm.ollama.baseUrl');
            const model = this.get('llm.ollama.model');
            
            if (!baseUrl || !model) {
                return { valid: false, message: '請設定 Ollama 位址和模型' };
            }
        }

        return { valid: true, message: 'LLM 設定有效' };
    }

    /**
     * 取得 LLM 設定供 explain 模組使用
     */
    getLLMConfig() {
        return {
            enabled: this.get('llm.enabled'),
            provider: this.get('llm.provider'),
            allowNetwork: this.get('llm.allowNetwork'),
            ollama: {
                baseUrl: this.get('llm.ollama.baseUrl'),
                model: this.get('llm.ollama.model')
            },
            openai: {
                baseUrl: this.get('llm.openai.baseUrl'),
                apiKey: this.get('llm.openai.apiKey')
            }
        };
    }
}

export class SettingsUI {
    constructor(settingsManager) {
        this.settings = settingsManager;
        this.isOpen = false;
        this.element = null;
        this.eventListeners = {};
    }

    /**
     * 添加事件監聽器
     * @param {string} event - 事件名稱
     * @param {Function} callback - 回調函數
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * 觸發事件
     * @param {string} event - 事件名稱
     * @param {any} data - 事件數據
     */
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach((callback) => {
                callback(data);
            });
        }
    }

    /**
     * 渲染設定介面到指定容器
     * @param {HTMLElement} container - 容器元素
     */
    async render(container) {
        if (!this.element) {
            this.createUI();
            this.bindEvents();
        }
        
        container.appendChild(this.element);
        this.loadFormValues();
        this.addStyles();
    }

    /**
     * 創建設定介面
     */
    createUI() {
        this.element = document.createElement('div');
        this.element.className = 'settings-panel';
        this.element.innerHTML = `
            <div class="settings-header">
                <h2>設定</h2>
                <button class="settings-close" title="關閉">&times;</button>
            </div>
            <div class="settings-content">
                
                <!-- 主題設定 -->
                <div class="settings-group">
                    <h3>場景</h3>
                    <div class="settings-field">
                        <label>
                            <input type="radio" name="theme" value="light" /> 淺色主題
                        </label>
                    </div>
                    <div class="settings-field">
                        <label>
                            <input type="radio" name="theme" value="dark" /> 深色主題
                        </label>
                    </div>
                </div>

                <!-- LLM 設定 -->
                <div class="settings-group">
                    <h3>LLM 設定</h3>
                    <div class="settings-field">
                        <label>
                            <input type="checkbox" id="llm-enabled" />
                            啟用 LLM（高品質解說）
                        </label>
                    </div>
                    
                    <div class="settings-field llm-setting">
                        <label>Provider：</label>
                        <select id="llm-provider">
                            <option value="ollama">本地 Ollama</option>
                            <option value="openai">OpenAI API</option>
                        </select>
                    </div>
                    
                    <div class="settings-field llm-setting">
                        <label>
                            <input type="checkbox" id="llm-allow-network" />
                            允許網路連線
                        </label>
                        <small class="settings-hint">開啟後可使用 OpenAI 等雲端服務</small>
                    </div>
                </div>

                <!-- Ollama 設定 -->
                <div class="settings-group ollama-settings">
                    <h3>Ollama 設定</h3>
                    <div class="settings-field">
                        <label>Ollama 位址：</label>
                        <input type="text" id="ollama-baseurl" placeholder="http://localhost:11434" />
                    </div>
                    <div class="settings-field">
                        <label>模型：</label>
                        <input type="text" id="ollama-model" placeholder="qwen2.5:7b-instruct" />
                        <small class="settings-hint">如果模型不存在，請先執行: ollama pull qwen2.5:7b-instruct</small>
                    </div>
                </div>

                <!-- OpenAI 設定 -->
                <div class="settings-group openai-settings">
                    <h3>OpenAI 設定</h3>
                    <div class="settings-field">
                        <label>Base URL（可選）：</label>
                        <input type="text" id="openai-baseurl" placeholder="留空使用官方 API" />
                    </div>
                    <div class="settings-field">
                        <label>API Key：</label>
                        <input type="password" id="openai-apikey" placeholder="sk-..." />
                        <small class="settings-hint security-warning">
                            ⚠️ API Key 僅儲存於本機瀏覽器，不會上傳到任何伺服器
                        </small>
                    </div>
                </div>

                <!-- 隱私提示 -->
                <div class="settings-group">
                    <div class="privacy-notice">
                        <h4>隱私說明</h4>
                        <ul>
                            <li>所有設定僅保存在您的瀏覽器本地存儲</li>
                            <li>API Key 不會被傳送至我們的伺服器</li>
                            <li>使用 OpenAI 時資料會傳送至 OpenAI 伺服器</li>
                            <li>建議優先使用本地 Ollama 以確保隱私</li>
                        </ul>
                    </div>
                </div>

                <!-- 狀態指示 -->
                <div class="settings-group">
                    <div class="settings-status">
                        <h4>狀態</h4>
                        <div id="llm-status">檢查中...</div>
                        <div id="network-status">檢查中...</div>
                    </div>
                </div>

                <div class="settings-actions">
                    <button class="settings-btn-primary" id="settings-save">儲存設定</button>
                    <button class="settings-btn-secondary" id="settings-reset">重設為預設值</button>
                </div>
            </div>
        `;

        // 加入樣式
        this.addStyles();
    }

    /**
     * 加入樣式
     */
    addStyles() {
        if (document.getElementById('settings-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'settings-styles';
        style.textContent = `
            .settings-panel {
                position: fixed;
                top: 0;
                right: -420px;
                width: 400px;
                height: 100vh;
                background: #f5f5f5;
                border-left: 1px solid #ddd;
                z-index: 1000;
                transition: right 0.3s ease;
                overflow-y: auto;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
            }

            .settings-panel.open {
                right: 0;
            }

            .settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #ddd;
                background: #fff;
                position: sticky;
                top: 0;
            }

            .settings-header h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }

            .settings-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .settings-close:hover {
                color: #000;
            }

            .settings-content {
                padding: 20px;
            }

            .settings-group {
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid #eee;
            }

            .settings-group:last-child {
                border-bottom: none;
            }

            .settings-group h3 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #333;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .settings-group h4 {
                margin: 0 0 8px 0;
                font-size: 13px;
                font-weight: 600;
                color: #555;
            }

            .settings-field {
                margin-bottom: 12px;
            }

            .settings-field label {
                display: flex;
                align-items: center;
                font-size: 13px;
                color: #333;
                margin-bottom: 4px;
            }

            .settings-field input[type="text"],
            .settings-field input[type="password"],
            .settings-field select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 13px;
                box-sizing: border-box;
            }

            .settings-field input[type="checkbox"],
            .settings-field input[type="radio"] {
                margin-right: 8px;
            }

            .settings-hint {
                display: block;
                font-size: 11px;
                color: #666;
                margin-top: 4px;
                line-height: 1.3;
            }

            .security-warning {
                color: #d69e2e !important;
                font-weight: 500;
            }

            .privacy-notice {
                background: #f7fafc;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 12px;
            }

            .privacy-notice ul {
                margin: 8px 0 0 0;
                padding-left: 20px;
                font-size: 12px;
                color: #4a5568;
                line-height: 1.4;
            }

            .settings-status {
                background: #f8f9fa;
                border-radius: 4px;
                padding: 12px;
            }

            .settings-status div {
                font-size: 12px;
                margin-bottom: 4px;
                padding: 4px 0;
            }

            .settings-actions {
                display: flex;
                gap: 12px;
                margin-top: 24px;
            }

            .settings-btn-primary,
            .settings-btn-secondary {
                padding: 10px 20px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid;
                flex: 1;
            }

            .settings-btn-primary {
                background: #2563eb;
                color: white;
                border-color: #2563eb;
            }

            .settings-btn-primary:hover {
                background: #1d4ed8;
            }

            .settings-btn-secondary {
                background: white;
                color: #374151;
                border-color: #d1d5db;
            }

            .settings-btn-secondary:hover {
                background: #f9fafb;
            }

            .llm-setting {
                opacity: 0.5;
                pointer-events: none;
                transition: opacity 0.2s;
            }

            .llm-setting.enabled {
                opacity: 1;
                pointer-events: auto;
            }

            .ollama-settings,
            .openai-settings {
                display: none;
            }

            .ollama-settings.active,
            .openai-settings.active {
                display: block;
            }

            /* 深色主題 */
            .theme-dark .settings-panel {
                background: #2d2d2d;
                border-left-color: #444;
                color: #e0e0e0;
            }

            .theme-dark .settings-header {
                background: #3a3a3a;
                border-bottom-color: #444;
            }

            .theme-dark .settings-group {
                border-bottom-color: #444;
            }

            .theme-dark .settings-field input,
            .theme-dark .settings-field select {
                background: #404040;
                border-color: #555;
                color: #e0e0e0;
            }

            .theme-dark .privacy-notice {
                background: #3a3a3a;
                border-color: #555;
            }

            .theme-dark .settings-status {
                background: #3a3a3a;
            }

            .theme-dark .settings-btn-secondary {
                background: #404040;
                border-color: #555;
                color: #e0e0e0;
            }

            .theme-dark .settings-btn-secondary:hover {
                background: #4a4a4a;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 關閉按鈕
        this.element.querySelector('.settings-close').addEventListener('click', () => {
            this.close();
        });

        // 主題變更
        this.element.querySelectorAll('input[name="theme"]').forEach((radio) => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.settings.set('theme', e.target.value);
                    this.emit('settingsChanged', { key: 'theme', value: e.target.value });
                }
            });
        });

        // LLM 啟用
        const llmEnabled = this.element.querySelector('#llm-enabled');
        llmEnabled.addEventListener('change', (e) => {
            this.settings.set('llm.enabled', e.target.checked);
            this.updateLLMSettings();
        });

        // LLM Provider
        const llmProvider = this.element.querySelector('#llm-provider');
        llmProvider.addEventListener('change', (e) => {
            this.settings.set('llm.provider', e.target.value);
            this.updateProviderSettings();
        });

        // 網路允許
        const allowNetwork = this.element.querySelector('#llm-allow-network');
        allowNetwork.addEventListener('change', (e) => {
            this.settings.set('llm.allowNetwork', e.target.checked);
            this.updateNetworkSettings();
        });

        // Ollama 設定
        const ollamaBaseUrl = this.element.querySelector('#ollama-baseurl');
        ollamaBaseUrl.addEventListener('change', (e) => {
            this.settings.set('llm.ollama.baseUrl', e.target.value);
        });

        const ollamaModel = this.element.querySelector('#ollama-model');
        ollamaModel.addEventListener('change', (e) => {
            this.settings.set('llm.ollama.model', e.target.value);
        });

        // OpenAI 設定
        const openaiBaseUrl = this.element.querySelector('#openai-baseurl');
        openaiBaseUrl.addEventListener('change', (e) => {
            this.settings.set('llm.openai.baseUrl', e.target.value);
        });

        const openaiApiKey = this.element.querySelector('#openai-apikey');
        openaiApiKey.addEventListener('change', (e) => {
            this.settings.set('llm.openai.apiKey', e.target.value);
        });

        // 儲存設定
        this.element.querySelector('#settings-save').addEventListener('click', () => {
            this.saveAndValidate();
        });

        // 重設設定
        this.element.querySelector('#settings-reset').addEventListener('click', () => {
            /* eslint-disable no-alert */
            if (confirm('確定要重設所有設定為預設值嗎？')) {
            /* eslint-enable no-alert */
                this.settings.reset();
                this.loadFormValues();
            }
        });
    }

    /**
     * 開啟設定面板
     */
    open() {
        if (!this.element.parentNode) {
            document.body.appendChild(this.element);
        }
        
        this.loadFormValues();
        this.element.classList.add('open');
        this.isOpen = true;
    }

    /**
     * 關閉設定面板
     */
    close() {
        this.element.classList.remove('open');
        this.isOpen = false;
    }

    /**
     * 載入表單值
     */
    loadFormValues() {
        // 主題
        const theme = this.settings.get('theme');
        this.element.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;

        // LLM 設定
        this.element.querySelector('#llm-enabled').checked = this.settings.get('llm.enabled');
        this.element.querySelector('#llm-provider').value = this.settings.get('llm.provider');
        this.element.querySelector('#llm-allow-network').checked = this.settings.get('llm.allowNetwork');

        // Ollama 設定
        this.element.querySelector('#ollama-baseurl').value = this.settings.get('llm.ollama.baseUrl');
        this.element.querySelector('#ollama-model').value = this.settings.get('llm.ollama.model');

        // OpenAI 設定
        this.element.querySelector('#openai-baseurl').value = this.settings.get('llm.openai.baseUrl');
        this.element.querySelector('#openai-apikey').value = this.settings.get('llm.openai.apiKey');

        this.updateLLMSettings();
        this.updateProviderSettings();
        this.updateNetworkSettings();
    }

    /**
     * 更新 LLM 設定可用性
     */
    updateLLMSettings() {
        const enabled = this.element.querySelector('#llm-enabled').checked;
        const llmSettings = this.element.querySelectorAll('.llm-setting');
        
        llmSettings.forEach((setting) => {
            if (enabled) {
                setting.classList.add('enabled');
            } else {
                setting.classList.remove('enabled');
            }
        });
    }

    /**
     * 更新 Provider 設定顯示
     */
    updateProviderSettings() {
        const provider = this.element.querySelector('#llm-provider').value;
        const ollamaSettings = this.element.querySelector('.ollama-settings');
        const openaiSettings = this.element.querySelector('.openai-settings');

        ollamaSettings.classList.remove('active');
        openaiSettings.classList.remove('active');

        if (provider === 'ollama') {
            ollamaSettings.classList.add('active');
        } else if (provider === 'openai') {
            openaiSettings.classList.add('active');
        }
    }

    /**
     * 更新網路設定
     */
    updateNetworkSettings() {
        const allowNetwork = this.element.querySelector('#llm-allow-network').checked;
        const provider = this.element.querySelector('#llm-provider').value;
        const openaiOption = this.element.querySelector('#llm-provider option[value="openai"]');

        if (!allowNetwork && provider === 'openai') {
            this.element.querySelector('#llm-provider').value = 'ollama';
            this.settings.set('llm.provider', 'ollama');
            this.updateProviderSettings();
        }

        openaiOption.disabled = !allowNetwork;
    }

    /**
     * 儲存並驗證設定
     */
    saveAndValidate() {
        const validation = this.settings.validateLLMSettings();
        const statusDiv = this.element.querySelector('#llm-status');
        
        if (validation.valid) {
            statusDiv.textContent = `✓ ${validation.message}`;
            statusDiv.style.color = '#059669';
        } else {
            statusDiv.textContent = `✗ ${validation.message}`;
            statusDiv.style.color = '#dc2626';
        }

        // 更新網路狀態
        const networkDiv = this.element.querySelector('#network-status');
        const allowNetwork = this.settings.get('llm.allowNetwork');
        networkDiv.textContent = allowNetwork ? '✓ 允許網路連線' : '✓ 離線模式';
        networkDiv.style.color = '#059669';
    }
}
