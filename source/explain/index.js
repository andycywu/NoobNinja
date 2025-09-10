/**
 * Explain Main Module - 整合所有 explain 功能的主模組
 * 提供統一的介面來使用模型解釋功能
 */

/* eslint-disable no-unused-vars */

import { ModelSummarizer } from './summarizer.js';
import { RulesEngine } from './rules.js';
import { DummyRunner } from './dummy-run.js';
import { LLMProviders } from './llm-providers.js';
import { PromptTemplates } from './prompt.js';
import { Validator } from './validator.js';
import { Exporter } from './exporter.js';

export class ExplainEngine {
    constructor() {
        this.summarizer = new ModelSummarizer();
        this.rulesEngine = new RulesEngine();
        this.dummyRunner = new DummyRunner();
        this.llmProviders = new LLMProviders();
        this.promptTemplates = new PromptTemplates();
        this.validator = new Validator();
        this.exporter = new Exporter();

        this.settings = {
            enableLLM: false,
            llmProvider: 'ollama',
            enableDummyRun: true,
            language: '繁體中文',
            autoDetectLLM: true  // 自動檢測可用的 LLM
        };

        this.cache = new Map();
        this._llmAvailable = null; // 快取 LLM 可用性
        // 用來確保一次只跑一個模型的 LLM/分析工作
        this._llmQueue = [];
        this._llmRunning = false;
    }

    /**
     * 完整分析模型
     * @param {Object} model - Netron 模型物件
     * @param {ArrayBuffer} modelBuffer - 模型二進位數據（可選）
     * @returns {Promise<Object>} 完整的分析結果
     */
    async analyzeModel(model, modelBuffer = null) {
        try {

            console.log('🔍 [ExplainEngine] 開始分析模型...', {
                enableLLM: this.settings.enableLLM,
                autoDetectLLM: this.settings.autoDetectLLM,
                llmProvider: this.settings.llmProvider,
                modelName: model?.name || 'Unknown',
                modelFormat: model?.format || 'Unknown'
            });

            // 快取檢查：如果 model 上已有先前分析結果，且使用相同的 explain 設定，則直接回傳快取結果
            const settingsSnapshot = {
                enableLLM: this.settings.enableLLM,
                llmProvider: this.settings.llmProvider,
                enableDummyRun: this.settings.enableDummyRun,
                language: this.settings.language,
                autoDetectLLM: this.settings.autoDetectLLM
            };
            try {
                if (model && model._explainAnalysis && model._explainAnalysisSettings) {
                    const s = model._explainAnalysisSettings;
                    const same = s && s.enableLLM === settingsSnapshot.enableLLM && s.llmProvider === settingsSnapshot.llmProvider && s.enableDummyRun === settingsSnapshot.enableDummyRun && s.language === settingsSnapshot.language && s.autoDetectLLM === settingsSnapshot.autoDetectLLM;
                    if (same) {
                        console.log('🔁 [ExplainEngine] 使用 model 上的快取分析結果');
                        return model._explainAnalysis;
                    }
                }
            } catch (e) {
                // ignore cache check errors
            }

            // 在快取檢查之後，若已有其他分析在跑，將本次請求排隊
            if (this._llmRunning) {
                // 設定 model 狀態為 queued，方便 UI 顯示
                try {
                    if (model) {
                        model._explainStatus = 'queued';
                    }
                } catch {}
                return await new Promise((resolve, reject) => {
                    this._llmQueue.push({ model, modelBuffer, resolve, reject });

                    console.log('🔁 [ExplainEngine] 分析隊列：已排隊，等待前一個工作完成');

                });
            }

            // 鎖定，表示開始一個新的分析工作
            this._llmRunning = true;
            try {
                if (model) {
                    model._explainStatus = 'running';
                }
            } catch {}

            // 1. 生成模型摘要
            const summary = this.summarizer.summarize(model);

            console.log('📊 [ExplainEngine] 模型摘要完成:', {
                format: summary.format,
                inputs: summary.inputs.length,
                outputs: summary.outputs.length,
                taskGuess: summary.taskGuess?.value || 'unknown'
            });

            // 2. 生成基於規則的解釋
            const rulesExplanation = this.rulesEngine.generateExplanation(summary);

            console.log('📋 [ExplainEngine] 規則引擎解釋完成:', {
                hasPurpose: Boolean(rulesExplanation.purpose),
                hasInputs: Boolean(rulesExplanation.inputRequirements),
                hasOutputs: Boolean(rulesExplanation.outputMeaning)
            });

            let finalExplanation = rulesExplanation;
            let validationResult = null;
            let dummyRunResult = null;

            // 3. 自動檢測並嘗試使用 LLM
            let usedLLM = false;
            if (this.settings.autoDetectLLM || this.settings.enableLLM) {

                console.log('🤖 [ExplainEngine] 檢查 LLM 可用性...');

                const llmAvailable = await this._checkLLMAvailability();

                console.log('🤖 [ExplainEngine] LLM 可用性結果:', llmAvailable);

                if (llmAvailable) {
                    try {

                        console.log('🚀 [ExplainEngine] 開始生成 LLM 解釋...');

                        const llmExplanation = await this._generateLLMExplanation(summary);

                        console.log('✅ [ExplainEngine] LLM 解釋生成完成:', {
                            hasPurpose: Boolean(llmExplanation.purpose),
                            hasInputs: Boolean(llmExplanation.inputRequirements),
                            hasOutputs: Boolean(llmExplanation.outputMeaning),
                            hasApplications: Boolean(llmExplanation.applications)
                        });

                        // 4. 驗證 LLM 輸出
                        validationResult = this.validator.validate(
                            JSON.stringify(llmExplanation),
                            summary
                        );

                        console.log('🔍 [ExplainEngine] LLM 驗證結果:', {
                            isValid: validationResult.isValid,
                            confidence: validationResult.confidence
                        });

                        // 5. 根據驗證結果決定使用哪個解釋
                        if (validationResult.isValid && validationResult.confidence > 0.7) {
                            finalExplanation = llmExplanation;
                            usedLLM = true;

                            console.log('✅ [ExplainEngine] 使用 LLM 解釋 (高信心度)');

                        } else {
                            // 混合使用：LLM 的部分 + 規則引擎的安全部分
                            finalExplanation = this._mergeExplanations(rulesExplanation, llmExplanation, validationResult);
                            usedLLM = true; // 部分使用也算是使用了 LLM

                            console.log('🔄 [ExplainEngine] 混合使用 LLM + 規則引擎');

                        }
                    } catch (llmError) {

                        console.error('❌ [ExplainEngine] LLM 生成失敗，回退到規則引擎:', llmError.message);

                        // 保持使用 rulesExplanation
                    }
                } else {

                    console.log('❌ [ExplainEngine] LLM 不可用，使用規則引擎');

                }
            } else {

                console.log('⚠️ [ExplainEngine] LLM 已停用，使用規則引擎');

            }

            // 6. 如果啟用且支援，執行 dummy run
            if (this.settings.enableDummyRun && modelBuffer && summary.format.toLowerCase() === 'onnx') {
                try {
                    dummyRunResult = await this.dummyRunner.runModel(modelBuffer, summary);
                } catch (dummyError) {
                    console.warn('Dummy run 失敗:', dummyError.message);
                    dummyRunResult = { success: false, error: dummyError.message };
                }
            }

            // 7. 整合所有結果
            const analysisResult = {
                summary,
                explanation: finalExplanation,
                validationResult,
                dummyRunResult,
                metadata: {
                    analysisTime: new Date().toISOString(),
                    usedLLM,
                    enabledLLM: this.settings.enableLLM,
                    autoDetectedLLM: this.settings.autoDetectLLM && usedLLM,
                    llmProvider: (usedLLM && this.settings.llmProvider) ? this.settings.llmProvider : null,
                    confidence: validationResult ? validationResult.confidence : 1.0
                }
            };
            // 將 LLM 的原始 prompt/raw 放到 analysisResult 頂層作為 fallback，方便 UI 直接讀取
            try {
                analysisResult._llmRaw = (finalExplanation && finalExplanation._llmRaw) || null;
                analysisResult._llmPrompt = (finalExplanation && finalExplanation._llmPrompt) || null;
            } catch {
                // ignore
            }

            // 快取結果
            this._cacheResult(model, analysisResult);
            // 同時在 model 上存一份，方便 UI 切換時快速重用
            try {
                if (model) {
                    model._explainAnalysis = analysisResult;
                    model._explainAnalysisSettings = settingsSnapshot;
                }
            } catch (e) {
                // ignore write-protected model
            }

            return analysisResult;
        } catch (error) {
            throw new Error(`模型分析失敗: ${error.message}`);
        } finally {
            // 釋放鎖並處理下一個排隊工作（若有）
            try {
                this._llmRunning = false;
                if (model) {
                    try {
                        model._explainStatus = 'idle';
                    } catch {}
                }
                if (this._llmQueue.length > 0) {
                    const job = this._llmQueue.shift();

                    console.log('🔁 [ExplainEngine] 開始處理下一個排隊的分析工作');

                    // 非阻塞地啟動下一個分析，但要將結果傳回原 Promise
                    this.analyzeModel(job.model, job.modelBuffer).then(job.resolve).catch(job.reject);
                }
            } catch (finallyErr) {
                // ignore
            }
        }
    }

    /**
     * 配置設定
     * @param {Object} newSettings - 新設定
     */
    configure(newSettings) {
        // 映射設定欄位名稱
        if (newSettings.enabled !== undefined) {
            newSettings.enableLLM = newSettings.enabled;
        }
        if (newSettings.provider !== undefined) {
            newSettings.llmProvider = newSettings.provider;
        }

        this.settings = { ...this.settings, ...newSettings };

        // 配置 LLM 提供者
        if (newSettings.provider || newSettings.llmProvider) {
            const provider = newSettings.provider || newSettings.llmProvider;
            const config = {};

            if (provider === 'ollama' && newSettings.ollama) {
                config.baseUrl = newSettings.ollama.baseUrl;
                config.model = newSettings.ollama.model;
            } else if (provider === 'openai' && newSettings.openai) {
                config.baseUrl = newSettings.openai.baseUrl;
                config.apiKey = newSettings.openai.apiKey;
            }

            this.llmProviders.setProvider(provider, config);
        }
    }

    /**
     * 匯出模型包
     * @param {Object} analysisResult - 分析結果
     * @param {Object} options - 匯出選項
     * @returns {Promise<Blob|Array>} 匯出的檔案
     */
    async exportModelPackage(analysisResult, options = {}) {
        return await this.exporter.exportModelPackage(
            analysisResult.summary,
            analysisResult.explanation,
            options
        );
    }

    /**
     * 僅匯出 Model Card
     * @param {Object} analysisResult - 分析結果
     * @returns {string} Markdown 內容
     */
    exportModelCard(analysisResult) {
        return this.exporter.exportModelCard(
            analysisResult.summary,
            analysisResult.explanation
        );
    }

    /**
     * 檢查 LLM 可用性
     * @returns {Promise<Array>} 可用的 LLM 提供者
     */
    async checkLLMAvailability() {
        return await this.llmProviders.getAvailableProviders();
    }

    /**
     * 檢查單一 LLM 可用性（內部使用）
     * @returns {Promise<boolean>} 是否有可用的 LLM
     */
    async _checkLLMAvailability() {
        if (this._llmAvailable !== null) {
            return this._llmAvailable;
        }

        try {
            const availableProviders = await this.llmProviders.getAvailableProviders();
            this._llmAvailable = availableProviders.length > 0;

            // 10分鐘後重新檢測
            setTimeout(() => {
                this._llmAvailable = null;
            }, 10 * 60 * 1000);

            return this._llmAvailable;
        } catch {
            this._llmAvailable = false;
            return false;
        }
    }

    /**
     * 檢查 Dummy Run 支援
     * @returns {boolean} 是否支援
     */
    checkDummyRunSupport() {
        return DummyRunner.isSupported();
    }

    /**
     * 生成 LLM 解釋
     */
    async _generateLLMExplanation(summary) {

        console.log('[LLM Generation] 準備生成提示詞...', {
            language: this.settings.language,
            format: summary.format,
            taskGuess: summary.taskGuess?.value
        });

        const prompt = this.promptTemplates.generateExplainPrompt(summary, {
            language: this.settings.language
        });

        console.log('[LLM Generation] 提示詞長度:', prompt.length);
        console.log('[LLM Generation] 完整提示詞:', prompt);

        const llmResponse = await this.llmProviders.generateExplanation(prompt);

        console.log('[LLM Generation] LLM 原始回應長度:', llmResponse.length);
        console.log('[LLM Generation] LLM 原始回應內容:', llmResponse);

        // 解析 LLM 回應（假設回應是結構化的）
        const parsedResponse = this._parseLLMResponse(llmResponse, summary) || {};
        // 把原始 prompt 和原始 LLM 回應保留在解析結果，方便 UI 顯示
        try {
            parsedResponse._llmPrompt = prompt;
            parsedResponse._llmRaw = llmResponse;
        } catch {
            // ignore
        }

        console.log('[LLM Generation] 解析後的結果:', parsedResponse);

        return parsedResponse;
    }

    /**
     * 解析 LLM 回應
     */
    _parseLLMResponse(response, summary) {
        // 簡化版解析 - 實際應該更智能
        const explanation = {
            purpose: this._extractSection(response, '模型用途'),
            inputRequirements: this._extractInputRequirements(response),
            outputMeaning: this._extractOutputMeaning(response),
            applications: this._extractApplications(response),
            quickstartCode: this._extractCode(response),
            limitations: this._extractLimitations(response),
            performance: this._extractPerformance(response)
        };

        return explanation;
    }

    /**
     * 混合解釋結果
     */
    _mergeExplanations(rulesExplanation, llmExplanation, validationResult) {
        const merged = { ...rulesExplanation };

        // 只使用驗證通過的 LLM 部分
        if (validationResult.confidence > 0.8) {
            merged.purpose = llmExplanation.purpose || rulesExplanation.purpose;
            merged.applications = llmExplanation.applications || rulesExplanation.applications;
        }

        // 程式碼部分比較敏感，只有高信心度才使用
        if (validationResult.confidence > 0.9) {
            merged.quickstartCode = llmExplanation.quickstartCode || rulesExplanation.quickstartCode;
        }

        // 保留原始 LLM 資訊，方便 UI 顯示完整原文
        try {
            if (llmExplanation && typeof llmExplanation === 'object') {
                if (llmExplanation._llmRaw) {
                    merged._llmRaw = llmExplanation._llmRaw;
                }
                if (llmExplanation._llmPrompt) {
                    merged._llmPrompt = llmExplanation._llmPrompt;
                }
            }
        } catch (e) {
            // ignore
        }

        return merged;
    }

    /**
     * 快取結果
     */
    _cacheResult(model, result) {
        const key = this._generateCacheKey(model);
        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });

        // 清理舊快取（保留最近 10 個）
        if (this.cache.size > 10) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            this.cache.delete(entries[0][0]);
        }
    }

    /**
     * 生成快取鍵
     */
    _generateCacheKey(model) {
        // 簡化版：基於模型名稱和格式
        return `${model.format || 'unknown'}_${model.name || 'unnamed'}_${Date.now()}`;
    }

    /**
     * 提取回應中的章節
     */
    _extractSection(response, sectionName) {
        const regex = new RegExp(`##\\s*${sectionName}([\\s\\S]*?)(?=##|$)`, 'i');
        const match = response.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * 提取輸入需求
     */
    _extractInputRequirements(response) {
        const section = this._extractSection(response, '輸入需求');
        if (!section) {
            return [];
        }

        // 簡化解析 - 實際應該更複雜
        return [
            {
                name: 'input',
                description: section
            }
        ];
    }

    /**
     * 提取輸出含義
     */
    _extractOutputMeaning(response) {
        const section = this._extractSection(response, '輸出含義');
        if (!section) {
            return [];
        }

        return [
            {
                name: 'output',
                description: section
            }
        ];
    }

    /**
     * 提取應用場景
     */
    _extractApplications(response) {
        const section = this._extractSection(response, '應用場景');
        if (!section) {
            return [];
        }

        // 提取列表項目
        const items = section.match(/[-*]\s*(.+)/g) || [];
        return items.map((item) => item.replace(/[-*]\s*/, '').trim());
    }

    /**
     * 提取程式碼
     */
    _extractCode(response) {
        const codeBlocks = response.match(/```[\s\S]*?```/g) || [];
        const code = {};

        for (const block of codeBlocks) {
            const content = block.replace(/```/g, '').trim();
            if (content.includes('python') || content.includes('import')) {
                code.python = content;
            } else if (content.includes('javascript') || content.includes('const')) {
                code.javascript = content;
            }
        }

        return code;
    }

    /**
     * 提取限制
     */
    _extractLimitations(response) {
        const section = this._extractSection(response, '注意事項');
        if (!section) {
            return [];
        }

        const items = section.match(/[-*]\s*(.+)/g) || [];
        return items.map((item) => item.replace(/[-*]\s*/, '').trim());
    }

    /**
     * 提取性能建議
     */
    _extractPerformance(response) {
        const section = this._extractSection(response, '使用建議');
        if (!section) {
            return [];
        }

        const items = section.match(/[-*]\s*(.+)/g) || [];
        return items.map((item) => item.replace(/[-*]\s*/, '').trim());
    }

    /**
     * 獲取統計資訊
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            llmEnabled: this.settings.enableLLM,
            dummyRunEnabled: this.settings.enableDummyRun,
            supportedProviders: Object.keys(this.llmProviders.providers),
            dummyRunSupported: this.checkDummyRunSupport()
        };
    }
}
