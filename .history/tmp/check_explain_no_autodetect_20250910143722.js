import { ExplainEngine } from '../source/explain/index.js';

async function run() {
    const engine = new ExplainEngine();
    // 完全關閉 LLM 與自動偵測
    engine.configure({ enableLLM: false, autoDetectLLM: false, enableDummyRun: false });

    const mockModel = {
        name: 'mock-model-no-llm',
        format: 'onnx',
        _modules: [
            {
                inputs: [ { name: 'input0', shape: [1,3,224,224], toString: () => 'float32[1,3,224,224]' } ],
                outputs: [ { name: 'output0', shape: [1,1000], toString: () => 'float32[1,1000]' } ],
                nodes: [ { type: 'Conv' }, { type: 'MatMul' } ]
            }
        ]
    };

    console.log('Starting explain analyze (no LLM)...');
    const result = await engine.analyzeModel(mockModel, null);
    console.log('Analyze result keys:', Object.keys(result));
    console.log('_llmRaw:', !!result._llmRaw, ' _llmPrompt:', !!result._llmPrompt);
    console.log('Model._explainStatus:', mockModel._explainStatus);
    console.log('Model._explainAnalysis exists:', !!mockModel._explainAnalysis);
    console.log('Model._explainAnalysisSettings:', mockModel._explainAnalysisSettings);
    console.log('Summary inputs netronRaw:', JSON.stringify(result.summary.inputs.map(i => i.netronRaw)));
    console.log('Summary outputs netronRaw:', JSON.stringify(result.summary.outputs.map(o => o.netronRaw)));
}

run().catch((e) => {
    console.error('Error running explain check (no autodetect):', e);
    process.exit(1);
});
