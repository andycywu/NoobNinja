/**
 * Prompt Templates - LLM 提示詞模板
 * 用於生成結構化的模型解釋
 */

export class PromptTemplates {
    constructor() {
        this.templates = {
            explain: this._getExplainTemplate(),
            quickstart: this._getQuickstartTemplate(),
            applications: this._getApplicationsTemplate(),
            limitations: this._getLimitationsTemplate()
        };
    }

    /**
     * 生成完整的解釋提示詞
     * @param {Object} summary - 模型摘要
     * @param {Object} options - 選項
     * @returns {string} 提示詞
     */
    generateExplainPrompt(summary, options = {}) {
        const template = this.templates.explain;
        const context = this._prepareContext(summary);

        return template
            .replace('{context}', context)
            .replace('{language}', options.language || '繁體中文')
            .replace('{format}', summary.format)
            .replace('{task}', summary.taskGuess);
    }

    /**
     * 生成程式碼範例提示詞
     * @param {Object} summary - 模型摘要
     * @param {string} language - 程式語言
     * @returns {string} 提示詞
     */
    generateQuickstartPrompt(summary, language = 'python') {
        const template = this.templates.quickstart;
        const context = this._prepareContext(summary);

        return template
            .replace('{context}', context)
            .replace('{language}', language)
            .replace('{format}', summary.format);
    }

    /**
     * 生成應用場景提示詞
     * @param {Object} summary - 模型摘要
     * @returns {string} 提示詞
     */
    generateApplicationsPrompt(summary) {
        const template = this.templates.applications;
        const context = this._prepareContext(summary);

        return template
            .replace('{context}', context)
            .replace('{task}', summary.taskGuess);
    }

    /**
     * 生成限制說明提示詞
     * @param {Object} summary - 模型摘要
     * @returns {string} 提示詞
     */
    generateLimitationsPrompt(summary) {
        const template = this.templates.limitations;
        const context = this._prepareContext(summary);

        return template
            .replace('{context}', context)
            .replace('{format}', summary.format);
    }

    /**
     * 準備模型上下文資訊
     * @param {Object} summary - 模型摘要
     * @returns {string} 格式化的上下文
     */
    _prepareContext(summary) {
        const context = {
            modelName: summary.modelName,
            format: summary.format,
            taskGuess: summary.taskGuess,
            inputs: summary.inputs,
            outputs: summary.outputs,
            operators: summary.operators,
            quantization: summary.quantization,
            runtimeHints: summary.runtimeHints
        };

        return JSON.stringify(context, null, 2);
    }

    /**
     * 模型解釋模板
     */
    _getExplainTemplate() {
        return `你是一個深度學習模型專家，擅長用簡單易懂的語言解釋複雜的模型。

請根據以下模型資訊，用 {language} 生成一份完整的模型解釋卡片：

模型資訊：
{context}

請按照以下格式輸出：

## 模型用途
[用 1-2 句話說明這個模型的主要功能和用途]

## 輸入需求
[詳細說明輸入數據的格式、尺寸、預處理要求]

## 輸出含義
[解釋每個輸出的含義和如何解讀結果]

## 應用場景
[列出 3-5 個實際應用場景]

## 使用建議
[提供使用上的技巧和最佳實踐]

## 注意事項
[說明限制和可能遇到的問題]

注意：
1. 使用白話文，避免過多技術術語
2. 重點關注實用性和可操作性
3. 不要編造不存在的資訊
4. 基於提供的模型資訊進行分析`;
    }

    /**
     * 程式碼範例模板
     */
    _getQuickstartTemplate() {
        return `請為以下 {format} 模型生成 {language} 語言的完整執行範例：

模型資訊：
{context}

請提供：
1. 完整的程式碼範例（包含註解）
2. 必要的套件安裝指令
3. 輸入數據準備步驟
4. 輸出結果解析方法

要求：
- 程式碼要可以直接執行
- 包含錯誤處理
- 添加詳細註解
- 使用最佳實踐
- 不要使用不存在的函數或套件`;
    }

    /**
     * 應用場景模板
     */
    _getApplicationsTemplate() {
        return `根據以下 {task} 類型的模型資訊，列出具體的應用場景：

模型資訊：
{context}

請提供：
1. 5-8 個具體的應用場景
2. 每個場景的簡短描述
3. 該場景的技術要求
4. 預期效果和限制

格式：
### 場景名稱
- 描述：[簡短描述]
- 要求：[技術要求]
- 效果：[預期效果]`;
    }

    /**
     * 限制說明模板
     */
    _getLimitationsTemplate() {
        return `分析以下 {format} 模型的技術限制和使用注意事項：

模型資訊：
{context}

請從以下角度分析：
1. 硬體需求限制
2. 軟體環境限制
3. 輸入數據限制
4. 精度和性能限制
5. 相容性限制

每個限制請提供：
- 具體描述
- 影響程度
- 解決或緩解方案（如果有的話）`;
    }

    /**
     * 驗證提示詞模板
     */
    getValidationPrompt(llmOutput, originalSummary) {
        return `請檢查以下 LLM 生成的模型解釋是否與實際模型資訊一致：

原始模型資訊：
${JSON.stringify(originalSummary, null, 2)}

LLM 生成的解釋：
${llmOutput}

請檢查：
1. 輸入輸出的 shape 和類型是否正確
2. 模型格式是否正確
3. 推斷的任務類型是否合理
4. 程式碼範例是否與實際 I/O 一致
5. 是否包含不存在的資訊

如果發現不一致的地方，請指出並提供修正建議。如果一致，請回答"驗證通過"。`;
    }
}
