/**
 * Explain Main Module - 整合所有 explain 功能的主模組
 * 提供統一的介面來使用模型解釋功能
 */

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
            language: '繁體中文'
        };

        this.cache = new Map();
    }

    /**
     * 完整分析模型
     * @param {Object} model - Netron 模型物件
     * @param {ArrayBuffer} modelBuffer - 模型二進位數據（可選）
     * @returns {Promise<Object>} 完整的分析結果
     */
    async analyzeModel(model, modelBuffer = null) {
        try {
            // 1. 生成模型摘要
            const summary = this.summarizer.summarize(model);

            // 2. 生成基於規則的解釋
            const rulesExplanation = this.rulesEngine.generateExplanation(summary);

            let finalExplanation = rulesExplanation;
            let validationResult = null;
            let dummyRunResult = null;

            // 3. 如果啟用 LLM，嘗試生成更詳細的解釋
            if (this.settings.enableLLM) {
                try {
                    const llmExplanation = await this._generateLLMExplanation(summary);

                    // 4. 驗證 LLM 輸出
                    validationResult = this.validator.validate(
                        JSON.stringify(llmExplanation),
                        summary
                    );

                    // 5. 根據驗證結果決定使用哪個解釋
                    if (validationResult.isValid && validationResult.confidence > 0.7) {
                        finalExplanation = llmExplanation;
                    } else {
                        // 混合使用：LLM 的部分 + 規則引擎的安全部分
                        finalExplanation = this._mergeExplanations(rulesExplanation, llmExplanation, validationResult);
                    }
                } catch (llmError) {
                    console.warn('LLM 生成失敗，回退到規則引擎:', llmError.message);
                    // 保持使用 rulesExplanation
                }
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
                    usedLLM: this.settings.enableLLM,
                    llmProvider: this.settings.enableLLM ? this.settings.llmProvider : null,
                    confidence: validationResult ? validationResult.confidence : 1.0
                }
            };

            // 快取結果
            this._cacheResult(model, analysisResult);

            return analysisResult;

        } catch (error) {
            throw new Error(`模型分析失敗: ${error.message}`);
        }
    }

    /**
     * 配置設定
     * @param {Object} newSettings - 新設定
     */
    configure(newSettings) {
        this.settings = { ...this.settings, ...newSettings };

        // 配置 LLM 提供者
        if (newSettings.llmProvider) {
            this.llmProviders.setProvider(newSettings.llmProvider, newSettings.llmConfig || {});
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
        const prompt = this.promptTemplates.generateExplainPrompt(summary, {
            language: this.settings.language
        });

        const llmResponse = await this.llmProviders.generateExplanation(prompt);

        // 解析 LLM 回應（假設回應是結構化的）
        return this._parseLLMResponse(llmResponse, summary);
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
        return [{
            name: 'input',
            description: section
        }];
    }

    /**
     * 提取輸出含義
     */
    _extractOutputMeaning(response) {
        const section = this._extractSection(response, '輸出含義');
        if (!section) {
            return [];
        }

        return [{
            name: 'output',
            description: section
        }];
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
