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
        // 包含更多來自 summarizer 的欄位，特別是 Netron 原始 metadata、usage 與 application
        // 以便 LLM 可以直接使用 Netron 提供的原始資訊（例如 tensor 的 raw 描述）來提升解析精準度
        // 建立一個更精簡的 summary，避免把整個物件塞進 prompt
        const compactSummary = {
            modelName: summary.modelName,
            format: summary.format,
            taskGuess: summary.taskGuess,
            operators: summary.operators,
            quantization: summary.quantization,
            usage: summary.usage || null,
            application: summary.application || summary.applications || null,
            metadata: summary.metadata || null
        };

        // 提取 inputs/outputs 的 netronRaw 作為顯著的 IO 原始描述
        const ioRaw = {
            inputs: (summary.inputs || []).map((i) => i.netronRaw || `${i.name}: ${JSON.stringify(i.shape)}`),
            outputs: (summary.outputs || []).map((o) => o.netronRaw || `${o.name}: ${JSON.stringify(o.shape)}`)
        };

        const context = {
            compactSummary,
            ioRaw,
            runtimeHints: summary.runtimeHints || null
        };

        return JSON.stringify(context, null, 2);
    }

    /**
     * 模型解釋模板
     */
    _getExplainTemplate() {
        return `你是一個深度學習模型專家，專門為初學者解釋複雜的AI模型。請用簡單易懂的白話文解釋模型。

請根據以下模型資訊，用 {language} 生成一份實用的模型說明：

模型資訊：
{context}

請按照以下格式輸出，每個部分都要具體實用：

## 📝 模型簡介
[用1-2句話說明這是什麼類型的模型，能解決什麼問題]

## 📥 輸入格式
[詳細說明輸入數據的要求：]
- 數據格式：[如：圖片、文字、數值等]
- 尺寸大小：[具體的shape，如：224x224彩色圖片]
- 數據範圍：[如：0-255的像素值需要正規化到0-1]
- 預處理：[必要的前處理步驟]

## 📤 輸出解讀
[說明模型輸出代表什麼意思：]
- 輸出格式：[shape 和內容說明]
- 如何解讀：[數值代表什麼意思]
- 後處理：[如何從輸出得到最終結果]

## 🎯 典型應用
[列出3-5個具體的使用場景，要實用且易理解]

## ⚡ 使用提示
[提供實用的使用建議和技巧]

## ⚠️ 注意限制
[說明模型的限制和使用時需要注意的地方]

重要要求：
1. 用白話文，避免艱深的技術術語
2. 提供具體的數值和範例
3. 重點講實用性，怎樣實際使用
4. 不要編造不存在的資訊
5. 如果某些資訊不確定，直接說"需要查看具體文檔"`;
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
