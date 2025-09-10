/**
 * Model Summarizer - 從 Netron 模型結構抽取摘要資訊
 * 支援 ONNX, TFLite, CoreML, TensorRT, OpenVINO IR 等格式
 */

export class ModelSummarizer {
    constructor() {
        this.supportedFormats = ['onnx', 'tflite', 'coreml', 'tensorrt', 'openvino'];

        // 任務識別模式
        this.taskPatterns = {
            classification: {
                outputs: /^(logits|scores|probabilities|output|classes)$/i,
                shapes: [
                    /^\[.*,\s*1000\]$/, // ImageNet 1k classes
                    /^\[.*,\s*224\]$/,  // Common classification output
                    /^\[.*,\s*21\]$/,   // Pascal VOC classes
                    /^\[.*,\s*80\]$/    // COCO classes (when single output)
                ],
                ops: ['Softmax', 'ArgMax', 'GlobalAveragePool']
            },
            detection: {
                outputs: /^(boxes|detections|output|bboxes|anchors)$/i,
                shapes: [
                    /^\[.*,\s*4\]$/,    // Bounding boxes
                    /^\[.*,\s*80\]$/,   // COCO classes
                    /^\[.*,\s*91\]$/    // COCO classes + background
                ],
                ops: ['NonMaxSuppression', 'NMS', 'Resize', 'Gather']
            },
            pose: {
                outputs: /^(keypoints|joints|pose|landmarks)$/i,
                shapes: [
                    /^\[.*,\s*17\]$/,   // COCO pose keypoints
                    /^\[.*,\s*51\]$/,   // 17 * 3 (x,y,visibility)
                    /^\[.*,\s*34\]$/    // 17 * 2 (x,y)
                ],
                ops: ['Conv', 'Upsample', 'Transpose']
            },
            segmentation: {
                outputs: /^(mask|segmentation|output)$/i,
                shapes: [
                    /^\[.*,\s*21,.*,.*\]$/,  // Pascal VOC segmentation
                    /^\[.*,\s*80,.*,.*\]$/   // COCO segmentation
                ],
                ops: ['Conv', 'Upsample', 'Sigmoid']
            }
        };
    }

    /**
     * 從 Netron 的 model 物件抽取模型摘要
     * @param {Object} model - Netron 的 model 物件
     * @returns {Object} 模型摘要 JSON
     */
    summarize(model) {
        if (!model || !model.graphs || model.graphs.length === 0) {
            return this._getEmptySummary();
        }

        const graph = model.graphs[0]; // 使用第一個 graph
        const summary = {
            modelName: this._extractModelName(model),
            format: this._detectFormat(model),
            inputs: this._extractInputs(graph),
            outputs: this._extractOutputs(graph),
            operators: this._analyzeOperators(graph),
            taskGuess: this._guessTaskWithConfidence(model, graph),
            quantization: this._checkQuantizationWithProvenance(graph),
            runtimeHints: this._suggestRuntimes(model),
            metadata: this._extractMetadata(model),
            complexity: this._estimateComplexity(graph)
        };

        return summary;
    }

    _getEmptySummary() {
        return {
            modelName: 'No Model Loaded',
            format: 'unknown',
            inputs: [],
            outputs: [],
            operators: { total: 0, types: {}, topOps: [] },
            taskGuess: 'unknown',
            quantization: { isQuantized: false, precision: 'fp32' },
            runtimeHints: ['cpu'],
            metadata: {},
            complexity: { parameters: 0, flops: 0, size: 0 }
        };
    }

    _extractModelName(model) {
        if (model.name) {
            return model.name;
        }
        if (model.metadata?.name) {
            return model.metadata.name;
        }
        if (model.metadata?.description) {
            return model.metadata.description.split('\n')[0];
        }
        return 'Unknown Model';
    }

    _detectFormat(model) {
        if (model.format) {
            return model.format.toLowerCase();
        }
        return 'unknown';
    }

    _extractInputs(graph) {
        const inputs = [];

        if (graph.inputs) {
            for (const input of graph.inputs) {
                inputs.push({
                    name: input.name || 'input',
                    shape: this._parseShape(input),
                    dtype: this._parseDtype(input),
                    domain: this._guessDomain(input)
                });
            }
        }

        return inputs;
    }

    _extractOutputs(graph) {
        const outputs = [];

        if (graph.outputs) {
            for (const output of graph.outputs) {
                outputs.push({
                    name: output.name || 'output',
                    shape: this._parseShape(output),
                    dtype: this._parseDtype(output),
                    semantics: this._guessSemantics(output)
                });
            }
        }

        return outputs;
    }

    _analyzeOperators(graph) {
        const opCounts = {};
        let total = 0;

        if (graph.nodes) {
            for (const node of graph.nodes) {
                const opType = node.type || node.op_type || 'unknown';
                opCounts[opType] = (opCounts[opType] || 0) + 1;
                total++;
            }
        }

        // 取前 10 個最常見的算子
        const topOps = Object.entries(opCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([op, count]) => ({ op, count }));

        return {
            total,
            types: opCounts,
            topOps
        };
    }

    _guessTask(summary) {
        // 基於輸入輸出形狀和算子類型的啟發式判斷
        for (const [task, pattern] of Object.entries(this.taskPatterns)) {
            if (this._matchesTaskPattern(summary, pattern)) {
                return task;
            }
        }
        return 'unknown';
    }

    _matchesTaskPattern(summary, pattern) {
        // 檢查輸出名稱
        const hasMatchingOutput = summary.outputs.some((output) =>
            pattern.outputs.test(output.name)
        );

        // 檢查 shape 模式
        const hasMatchingShape = summary.outputs.some((output) =>
            pattern.shapes.some((shapePattern) =>
                shapePattern.test(JSON.stringify(output.shape))
            )
        );

        // 檢查算子類型
        const hasMatchingOps = pattern.ops.some((op) =>
            summary.operators.types.hasOwnProperty(op)
        );

        return hasMatchingOutput || hasMatchingShape || hasMatchingOps;
    }

    _parseShape(tensor) {
        if (tensor.type?.shape?.dimensions) {
            return tensor.type.shape.dimensions.map((dim) => {
                if (typeof dim === 'object' && dim.size !== undefined) {
                    return dim.size;
                }
                return dim || '?';
            });
        }
        return [];
    }

    _parseDtype(tensor) {
        if (tensor.type?.dataType) {
            return tensor.type.dataType;
        }
        return 'unknown';
    }

    _guessDomain(input) {
        const shape = this._parseShape(input);
        const name = input.name?.toLowerCase() || '';

        // 根據形狀推斷
        if (shape.length === 4) {
            if (shape[1] === 3 || shape[3] === 3) {
                return 'image';
            }
        }
        if (shape.length === 2) {
            return 'tabular';
        }
        if (shape.length === 3) {
            return 'sequence';
        }

        // 根據名稱推斷
        if (name.includes('image') || name.includes('pixel')) {
            return 'image';
        }
        if (name.includes('text') || name.includes('token')) {
            return 'text';
        }

        return 'unknown';
    }

    _guessSemantics(output) {
        const shape = this._parseShape(output);
        const name = output.name?.toLowerCase() || '';

        // 根據名稱推斷
        if (name.includes('box') || name.includes('bbox')) {
            return 'bounding_boxes';
        }
        if (name.includes('class') || name.includes('label') || name.includes('logit')) {
            return 'classification';
        }
        if (name.includes('mask')) {
            return 'segmentation_mask';
        }
        if (name.includes('keypoint') || name.includes('pose') || name.includes('joint')) {
            return 'keypoints';
        }
        if (name.includes('score') || name.includes('conf') || name.includes('prob')) {
            return 'confidence_scores';
        }

        // 根據形狀推斷
        if (shape.length === 2 && shape[1] < 10000) {
            return 'logits';
        }
        if (shape.length >= 3 && shape[shape.length - 1] === 4) {
            return 'bounding_boxes';
        }
        if (shape.length >= 2 && shape[shape.length - 1] % 2 === 0) {
            return 'keypoints';
        }

        return 'unknown';
    }

    _checkQuantization(graph) {
        const ops = this._analyzeOperators(graph);
        const quantOps = ['QuantizeLinear', 'DequantizeLinear', 'QLinearConv', 'QLinearMatMul'];
        const hasQuantOps = quantOps.some((op) => ops.types.hasOwnProperty(op));

        return {
            isQuantized: hasQuantOps,
            precision: hasQuantOps ? 'int8' : 'fp32',
            quantOpsCount: quantOps.reduce((sum, op) => sum + (ops.types[op] || 0), 0)
        };
    }

    _suggestRuntimes(model) {
        const format = this._detectFormat(model);
        const runtimes = ['cpu']; // 預設都支援 CPU

        switch (format) {
            case 'onnx':
                runtimes.push('onnxruntime', 'directml');
                if (this._checkQuantization(model.graphs?.[0]).isQuantized) {
                    runtimes.push('qnn');
                }
                break;
            case 'tflite':
                runtimes.push('tflite', 'coral');
                break;
            case 'coreml':
                runtimes.push('coreml', 'ane');
                break;
            case 'tensorrt':
                runtimes.push('tensorrt', 'cuda');
                break;
            case 'openvino':
                runtimes.push('openvino', 'npu');
                break;
        }

        return runtimes;
    }

    _extractMetadata(model) {
        const metadata = {};

        if (model.metadata) {
            metadata.producer = model.metadata.producer;
            metadata.version = model.metadata.version;
            metadata.domain = model.metadata.domain;
            metadata.docString = model.metadata.docString;
        }

        return metadata;
    }

    _estimateComplexity(graph) {
        let parameters = 0;
        let flops = 0;
        const size = 0;

        if (graph.nodes) {
            for (const node of graph.nodes) {
                // 簡單的參數和 FLOPS 估算
                const op = node.type || node.op_type;
                if (op === 'Conv' || op === 'MatMul') {
                    // 這是一個簡化的估算，實際應該根據具體參數計算
                    parameters += 1000; // 佔位符
                    flops += 10000; // 佔位符
                }
            }
        }

        return {
            parameters,
            flops,
            size // 可以從模型檔案大小獲得
        };
    }
}
