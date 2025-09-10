import { ExplainEngine } from '../source/explain/index.js';

async function run() {
    const engine = new ExplainEngine();
    // 關閉 LLM 以避免外部網路呼叫
    engine.configure({ enableLLM: false, enableDummyRun: false });

    // 建立一個最小模擬的 model 物件
    const mockModel = {
        name: 'mock-model',
        format: 'onnx',
        _modules: [
            {
                inputs: [ { name: 'input0', shape: [1,3,224,224], toString: () => 'float32[1,3,224,224]' } ],
                outputs: [ { name: 'output0', shape: [1,1000], toString: () => 'float32[1,1000]' } ],
                nodes: [ { type: 'Conv' }, { type: 'MatMul' } ]
            }
        ]
    };

    console.log('Starting explain analyze...');
    const result = await engine.analyzeModel(mockModel, null);
    console.log('Analyze result summary keys:', Object.keys(result));
    console.log('Has _llmRaw:', result._llmRaw !== undefined && result._llmRaw !== null);
    console.log('Has _llmPrompt:', result._llmPrompt !== undefined && result._llmPrompt !== null);
    console.log('Model._explainStatus:', mockModel._explainStatus);
    console.log('Model._explainAnalysis exists:', !!mockModel._explainAnalysis);
    console.log('Model._explainAnalysisSettings:', mockModel._explainAnalysisSettings);
    console.log('Summary inputs netronRaw:', result.summary.inputs.map(i => i.netronRaw));
    console.log('Summary outputs netronRaw:', result.summary.outputs.map(o => o.netronRaw));
}

run().catch((e) => {
    console.error('Error running explain check:', e);
    process.exit(1);
});
