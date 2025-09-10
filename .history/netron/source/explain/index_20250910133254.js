/**
 * Explain Main Module - restored from snapshot
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
            language: 'zh-tw',
            autoDetectLLM: true
        };

        this.cache = new Map();
        this._llmAvailable = null;
        this._llmQueue = [];
        this._llmRunning = false;
    }

    async analyzeModel(model, modelBuffer = null) {
        try {
            const settingsSnapshot = {
                enableLLM: this.settings.enableLLM,
                llmProvider: this.settings.llmProvider,
                enableDummyRun: this.settings.enableDummyRun,
                language: this.settings.language,
                autoDetectLLM: this.settings.autoDetectLLM
            };

            if (model && model._explainAnalysis && model._explainAnalysisSettings) {
                const s = model._explainAnalysisSettings;
                const same = s && s.enableLLM === settingsSnapshot.enableLLM && s.llmProvider === settingsSnapshot.llmProvider && s.enableDummyRun === settingsSnapshot.enableDummyRun && s.language === settingsSnapshot.language && s.autoDetectLLM === settingsSnapshot.autoDetectLLM;
                if (same) {
                    return model._explainAnalysis;
                }
            }

            if (this._llmRunning) {
                try { if (model) { model._explainStatus = 'queued'; } } catch {}
                return await new Promise((resolve, reject) => {
                    this._llmQueue.push({ model, modelBuffer, resolve, reject });
                });
            }

            this._llmRunning = true;
            try { if (model) { model._explainStatus = 'running'; } } catch {}

            const summary = this.summarizer.summarize(model);
            const rulesExplanation = this.rulesEngine.generateExplanation(summary);

            let finalExplanation = rulesExplanation;
            let validationResult = null;
            let dummyRunResult = null;
            let usedLLM = false;

            if (this.settings.autoDetectLLM || this.settings.enableLLM) {
                const llmAvailable = await this._checkLLMAvailability();
                if (llmAvailable) {
                    try {
                        const llmExplanation = await this._generateLLMExplanation(summary);
                        validationResult = this.validator.validate(
                            JSON.stringify(llmExplanation),
                            summary
                        );

                        if (validationResult.isValid && validationResult.confidence > 0.7) {
                            finalExplanation = llmExplanation; usedLLM = true;
                        } else {
                            finalExplanation = this._mergeExplanations(rulesExplanation, llmExplanation, validationResult);
                            usedLLM = true;
                        }
                    } catch (llmError) {
                        // fallback to rules
                    }
                }
            }

            if (this.settings.enableDummyRun && modelBuffer && summary.format.toLowerCase() === 'onnx') {
                try { dummyRunResult = await this.dummyRunner.runModel(modelBuffer, summary); } catch (e) { dummyRunResult = { success: false, error: e.message }; }
            }

            const analysisResult = { summary, explanation: finalExplanation, validationResult, dummyRunResult, metadata: { analysisTime: new Date().toISOString(), usedLLM, enabledLLM: this.settings.enableLLM, autoDetectedLLM: this.settings.autoDetectLLM && usedLLM, llmProvider: (usedLLM && this.settings.llmProvider) ? this.settings.llmProvider : null, confidence: validationResult ? validationResult.confidence : 1.0 } };
            try { analysisResult._llmRaw = (finalExplanation && finalExplanation._llmRaw) || null; analysisResult._llmPrompt = (finalExplanation && finalExplanation._llmPrompt) || null; } catch {}

            this._cacheResult(model, analysisResult);
            try { if (model) { model._explainAnalysis = analysisResult; model._explainAnalysisSettings = settingsSnapshot; } } catch (e) {}

            return analysisResult;
        } catch (error) {
            throw new Error(`model analyze failed: ${error.message}`);
        } finally {
            try {
                this._llmRunning = false;
                if (model) { try { model._explainStatus = 'idle'; } catch {} }
                if (this._llmQueue.length > 0) {
                    const job = this._llmQueue.shift();
                    this.analyzeModel(job.model, job.modelBuffer).then(job.resolve).catch(job.reject);
                }
            } catch {}
        }
    }

    configure(newSettings) {
        if (newSettings.enabled !== undefined) { newSettings.enableLLM = newSettings.enabled; }
        if (newSettings.provider !== undefined) { newSettings.llmProvider = newSettings.provider; }
        this.settings = { ...this.settings, ...newSettings };
        if (newSettings.provider || newSettings.llmProvider) {
            const provider = newSettings.provider || newSettings.llmProvider;
            const config = {};
            if (provider === 'ollama' && newSettings.ollama) { config.baseUrl = newSettings.ollama.baseUrl; config.model = newSettings.ollama.model; } else if (provider === 'openai' && newSettings.openai) { config.baseUrl = newSettings.openai.baseUrl; config.apiKey = newSettings.openai.apiKey; }
            this.llmProviders.setProvider(provider, config);
        }
    }

    async checkLLMAvailability() { return await this.llmProviders.getAvailableProviders(); }

    async _checkLLMAvailability() {
        if (this._llmAvailable !== null) { return this._llmAvailable; }
        try { const availableProviders = await this.llmProviders.getAvailableProviders(); this._llmAvailable = availableProviders.length > 0; setTimeout(() => { this._llmAvailable = null; }, 10 * 60 * 1000); return this._llmAvailable; } catch { this._llmAvailable = false; return false; }
    }

    async _generateLLMExplanation(summary) {
        const prompt = this.promptTemplates.generateExplainPrompt(summary, { language: this.settings.language });
        const llmResponse = await this.llmProviders.generateExplanation(prompt);
        const parsedResponse = this._parseLLMResponse(llmResponse, summary) || {};
        try { parsedResponse._llmPrompt = prompt; parsedResponse._llmRaw = llmResponse; } catch {}
        return parsedResponse;
    }

    _parseLLMResponse(response, summary) { const explanation = { purpose: this._extractSection(response, '模型用途'), inputRequirements: this._extractInputRequirements(response), outputMeaning: this._extractOutputMeaning(response), applications: this._extractApplications(response), quickstartCode: this._extractCode(response), limitations: this._extractLimitations(response), performance: this._extractPerformance(response) }; return explanation; }

    _mergeExplanations(rulesExplanation, llmExplanation, validationResult) { const merged = { ...rulesExplanation }; try { if (llmExplanation && typeof llmExplanation === 'object') { if (llmExplanation._llmRaw) { merged._llmRaw = llmExplanation._llmRaw; } if (llmExplanation._llmPrompt) { merged._llmPrompt = llmExplanation._llmPrompt; } } } catch (e) {} return merged; }

    _cacheResult(model, result) { const key = this._generateCacheKey(model); this.cache.set(key, { result, timestamp: Date.now() }); if (this.cache.size > 10) { const entries = Array.from(this.cache.entries()); entries.sort((a, b) => a[1].timestamp - b[1].timestamp); this.cache.delete(entries[0][0]); } }

    _generateCacheKey(model) { return `${model.format || 'unknown'}_${model.name || 'unnamed'}_${Date.now()}`; }

    _extractSection(response, sectionName) { const regex = new RegExp(`##\\s*${sectionName}([\\s\\S]*?)(?=##|$)`, 'i'); const match = response.match(regex); return match ? match[1].trim() : null; }

    // lightweight stubs for summarizer helpers
    getStats() { return { cacheSize: this.cache.size, llmEnabled: this.settings.enableLLM, dummyRunEnabled: this.settings.enableDummyRun, supportedProviders: Object.keys(this.llmProviders.providers), dummyRunSupported: this.checkDummyRunSupport() }; }

    checkDummyRunSupport() { return DummyRunner.isSupported(); }
}
