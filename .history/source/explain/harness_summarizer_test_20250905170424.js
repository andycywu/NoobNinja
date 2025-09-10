#!/usr/bin/env node
(async function main() {
    try {
        const { ModelSummarizer } = await import('./summarizer.js');

        // 模擬一個 factory-style 的 model（使用 modules 與 graph.input/graph.output 命名）
        const fakeGraph = {
            name: 'test_graph',
            input: [
                { name: 'input_1', toString: () => 'float32[1,3,224,224]' }
            ],
            output: [
                { name: 'output_1', toString: () => 'float32[1,1000]' }
            ],
            nodes: [{ type: 'Conv' }, { type: 'Relu' }]
        };

        const fakeModel = {
            identifier: 'test_model.onnx',
            format: 'onnx',
            modules: [fakeGraph],
            metadata: { producer: 'unit-test' }
        };

        const summarizer = new ModelSummarizer();
        const summary = summarizer.summarize(fakeModel);
        console.log('\n--- SUMMARY START ---\n');
        console.log(JSON.stringify(summary, null, 2));
        console.log('\n--- SUMMARY END ---\n');

        process.exit(0);
    } catch (err) {
        console.error(err.stack || err.message || err);
        process.exit(1);
    }
})();
