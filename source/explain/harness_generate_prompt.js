#!/usr/bin/env node
(async function main() {
    try {
        const { PromptTemplates } = await import('./prompt.js');
        const { LLMProviders } = await import('./llm-providers.js');

        const promptTemplates = new PromptTemplates();
        const llmProviders = new LLMProviders();

        // 模擬你提供的 model summary（pose_landmarks_detector_lite）
        const summary = {
            modelName: 'pose_landmarks_detector_lite',
            format: 'ONNX V7',
            operators: 200,
            inputs: [
                {
                    name: 'input_1',
                    shape: [],
                    dtype: 'unknown',
                    domain: 'unknown',
                    provenance: 'model',
                    confidence: 0.1,
                    netronRaw: 'input_1: shape=[], dtype=unknown'
                }
            ],
            outputs: [
                { name: 'Identity', shape: [], semantics: 'unknown', provenance: 'model', confidence: 0.1, netronRaw: 'Identity: shape=[]' },
                { name: 'Identity_1', shape: [], semantics: 'unknown', provenance: 'model', confidence: 0.1, netronRaw: 'Identity_1: shape=[]' },
                { name: 'Identity_2', shape: [], semantics: 'unknown', provenance: 'model', confidence: 0.1, netronRaw: 'Identity_2: shape=[]' },
                { name: 'Identity_3', shape: [], semantics: 'unknown', provenance: 'model', confidence: 0.1, netronRaw: 'Identity_3: shape=[]' },
                { name: 'Identity_4', shape: [], semantics: 'unknown', provenance: 'model', confidence: 0.1, netronRaw: 'Identity_4: shape=[]' }
            ],
            taskGuess: { value: 'detection', confidence: 0.9 },
            quantization: { status: '未量化', precision: 'fp32' },
            usage: '這是一個 ONNX V7 格式的物件偵測模型，使用 fp32 精度。它能夠在圖片中定位並識別多個物件。',
            application: ['自動駕駛', '監控系統', '零售分析', '機器人視覺', '增強現實'],
            metadata: {
                source: 'Netron',
                description: '從 Netron 解析得到的原始 metadata 範例'
            }
        };

        const prompt = promptTemplates.generateExplainPrompt(summary, { language: '繁體中文' });

        console.log('\n--- GENERATED PROMPT START ---\n');
        console.log(prompt);
        console.log('\n--- GENERATED PROMPT END ---\n');

        if (process.env.RUN_OLLAMA) {
            console.log('[HARNESS] RUN_OLLAMA enabled, attempting to call local Ollama...');
            try {
                llmProviders.setProvider('ollama', {});
                const response = await llmProviders.generateExplanation(prompt, {});
                console.log('\n--- LLM RESPONSE START ---\n');
                console.log(response);
                console.log('\n--- LLM RESPONSE END ---\n');
            } catch (e) {
                console.error('[HARNESS] Ollama call failed:', e.message || e);
            }
        } else {
            console.log('[HARNESS] RUN_OLLAMA not set — skipped actual LLM call. To call, run with RUN_OLLAMA=1');
        }

        process.exit(0);
    } catch (err) {
        console.error(err.stack || err.message || err);
        process.exit(1);
    }
})();
