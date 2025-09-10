/**
 * 模型摘要器測試
 */

import { ModelSummarizer } from '../summarizer.js';

// 模擬的 ONNX 模型數據
const mockONNXModel = {
    format: 'ONNX',
    name: 'ResNet50',
    graphs: [{
        inputs: [{
            name: 'input',
            type: {
                shape: {
                    dimensions: [1, 3, 224, 224]
                },
                dataType: 'float32'
            }
        }],
        outputs: [{
            name: 'output',
            type: {
                shape: {
                    dimensions: [1, 1000]
                },
                dataType: 'float32'
            }
        }],
        nodes: [
            { type: 'Conv' },
            { type: 'BatchNormalization' },
            { type: 'Relu' },
            { type: 'MaxPool' },
            { type: 'GlobalAveragePool' },
            { type: 'MatMul' },
            { type: 'Softmax' }
        ]
    }],
    metadata: {
        producer: 'pytorch',
        version: '1.12'
    }
};

// 測試函數
function testModelSummarizer() {
    console.log('🧪 測試模型摘要器...');

    const summarizer = new ModelSummarizer();
    const summary = summarizer.summarize(mockONNXModel);

    // 檢查基本資訊
    console.assert(summary.modelName === 'ResNet50', '模型名稱錯誤');
    console.assert(summary.format === 'onnx', '模型格式錯誤');
    console.assert(summary.taskGuess === 'classification', `任務推斷錯誤: ${summary.taskGuess}`);

    // 檢查輸入輸出
    console.assert(summary.inputs.length === 1, '輸入數量錯誤');
    console.assert(summary.outputs.length === 1, '輸出數量錯誤');
    console.assert(JSON.stringify(summary.inputs[0].shape) === '[1,3,224,224]', '輸入形狀錯誤');
    console.assert(JSON.stringify(summary.outputs[0].shape) === '[1,1000]', '輸出形狀錯誤');

    // 檢查算子統計
    console.assert(summary.operators.total === 7, `算子總數錯誤: ${summary.operators.total}`);
    console.assert(summary.operators.topOps.length > 0, '算子統計錯誤');

    // 檢查量化資訊
    console.assert(summary.quantization.isQuantized === false, '量化檢測錯誤');

    // 檢查 runtime 建議
    console.assert(summary.runtimeHints.includes('onnxruntime'), 'Runtime 建議錯誤');

    console.log('✅ 模型摘要器測試通過');
    console.log('摘要結果:', summary);

    return summary;
}

// 測試規則引擎
function testRulesEngine() {
    console.log('🧪 測試規則引擎...');

    // 動態載入模組
    import('../rules.js').then((module) => {
        const { RulesEngine } = module;
        const rulesEngine = new RulesEngine();

        // 使用上面的測試摘要
        const summary = testModelSummarizer();
        const explanation = rulesEngine.generateExplanation(summary);

        // 檢查解釋結果
        console.assert(explanation.purpose, '缺少用途說明');
        console.assert(explanation.inputRequirements.length > 0, '缺少輸入需求');
        console.assert(explanation.outputMeaning.length > 0, '缺少輸出說明');
        console.assert(explanation.applications.length > 0, '缺少應用場景');
        console.assert(explanation.quickstartCode.python, '缺少 Python 程式碼');

        console.log('✅ 規則引擎測試通過');
        console.log('解釋結果:', explanation);

        return explanation;
    }).catch((error) => {
        console.error('❌ 規則引擎測試失敗:', error);
    });
}

// 測試 LLM 提供者（檢查可用性）
async function testLLMProviders() {
    console.log('🧪 測試 LLM 提供者...');

    try {
        const { LLMProviders } = await import('../llm-providers.js');
        const llmProviders = new LLMProviders();

        // 檢查可用的提供者
        const availableProviders = await llmProviders.getAvailableProviders();
        console.log('可用的 LLM 提供者:', availableProviders);

        // 測試 Ollama 可用性
        const ollamaAvailable = await llmProviders.checkAvailability('ollama');
        console.log('Ollama 可用性:', ollamaAvailable);

        // 測試 OpenAI 可用性（沒有 API key 會失敗）
        const openaiAvailable = await llmProviders.checkAvailability('openai');
        console.log('OpenAI 可用性:', openaiAvailable);

        console.log('✅ LLM 提供者測試完成');

    } catch (error) {
        console.error('❌ LLM 提供者測試失敗:', error);
    }
}

// 測試 Dummy Runner 支援
function testDummyRunnerSupport() {
    console.log('🧪 測試 Dummy Runner 支援...');

    import('../dummy-run.js').then((module) => {
        const { DummyRunner } = module;

        const isSupported = DummyRunner.isSupported();
        console.log('Dummy Runner 支援:', isSupported);

        const supportedProviders = DummyRunner.getSupportedProviders();
        console.log('支援的執行提供者:', supportedProviders);

        console.log('✅ Dummy Runner 支援測試完成');

    }).catch((error) => {
        console.error('❌ Dummy Runner 測試失敗:', error);
    });
}

// 主測試函數
async function runAllTests() {
    console.log('🚀 開始執行 Explain 功能測試...\n');

    try {
        // 基礎功能測試
        testModelSummarizer();
        testRulesEngine();
        testDummyRunnerSupport();

        // 異步功能測試
        await testLLMProviders();

        console.log('\n🎉 所有測試完成！');

    } catch (error) {
        console.error('\n❌ 測試執行失敗:', error);
    }
}

// 如果在瀏覽器中直接執行
if (typeof window !== 'undefined') {
    window.runExplainTests = runAllTests;
    console.log('在瀏覽器控制台中執行 runExplainTests() 來開始測試');
}

// 如果作為模組匯出
export { testModelSummarizer, testRulesEngine, testLLMProviders, testDummyRunnerSupport, runAllTests };
