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
        console.log('🔍 [ModelSummarizer] 收到的 model 對象:', model);
        console.log('🔍 [ModelSummarizer] model 類型:', typeof model);
        console.log('🔍 [ModelSummarizer] model.graphs:', model?.graphs);
        console.log('🔍 [ModelSummarizer] model._modules:', model?._modules);
        console.log('🔍 [ModelSummarizer] model._modules 長度:', model?._modules?.length);
        console.log('🔍 [ModelSummarizer] model 所有屬性:', model ? Object.keys(model) : 'model is null');

        // 更詳細的檢查
        if (model) {
            console.log('🔍 [ModelSummarizer] model 是否存在:', Boolean(model));
            console.log('🔍 [ModelSummarizer] model._modules 是否存在:', Boolean(model._modules));
            console.log('🔍 [ModelSummarizer] model._modules 是否為陣列:', Array.isArray(model._modules));
            if (model._modules) {
                console.log('🔍 [ModelSummarizer] model._modules 內容:', model._modules);
                console.log('🔍 [ModelSummarizer] 第一個 module:', model._modules[0]);
            }
        }

        // 支援多種 Netron 模型結構
        let graphs = null;
        if (model && model._modules && model._modules.length > 0) {
            // ONNX 等格式使用 _modules
            graphs = model._modules;
            console.log('✅ [ModelSummarizer] 使用 _modules 結構，找到', graphs.length, '個模組');
        } else if (model && model.graphs && model.graphs.length > 0) {
            // 其他格式可能使用 graphs
            graphs = model.graphs;
            console.log('✅ [ModelSummarizer] 使用 graphs 結構，找到', graphs.length, '個圖');
        } else {
            console.error('❌ [ModelSummarizer] 模型結構檢查失敗:');
            console.error('  - model 存在:', Boolean(model));
            console.error('  - model._modules 存在:', Boolean(model && model._modules));
            console.error('  - model._modules 長度:', model?._modules?.length);
            console.error('  - model.graphs 存在:', Boolean(model && model.graphs));
            console.error('  - model.graphs 長度:', model?.graphs?.length);
        }

        if (!model || !graphs || graphs.length === 0) {
            console.warn('⚠️ [ModelSummarizer] 模型結構不符合預期，返回空摘要');
            return this._getEmptySummary();
        }

        const graph = graphs[0]; // 使用第一個 graph
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

        console.log('📊 [ModelSummarizer] 生成的摘要:', summary);
        return summary;
    }

    _getEmptySummary() {
        return {
            modelName: 'No Model Loaded',
            format: 'unknown',
            inputs: [],
            outputs: [],
            operators: { total: 0, types: {}, topOps: [] },
            taskGuess: {
                value: 'unknown',
                provenance: 'heuristic',
                confidence: 0.0
            },
            quantization: {
                isQuantized: false,
                precision: 'fp32',
                provenance: 'graph_scan',
                confidence: 1.0
            },
            runtimeHints: ['cpu'],
            metadata: {},
            complexity: { parameters: 0, flops: 0, size: 0 }
        };
    }

    _extractModelName(model) {
        // 支援 ONNX 模型的私有屬性結構
        if (model.name) {
            return model.name;
        }
        if (model._metadata?.name) {
            return model._metadata.name;
        }
        if (model.metadata?.name) {
            return model.metadata.name;
        }
        if (model._metadata?.description) {
            return model._metadata.description.split('\n')[0];
        }
        if (model.metadata?.description) {
            return model.metadata.description.split('\n')[0];
        }

        // 從檔案名稱或識別碼提取
        if (model.identifier) {
            const parts = model.identifier.split('/');
            const filename = parts[parts.length - 1];
            return filename.replace(/\.(onnx|pb|tflite|mlmodel)$/, '');
        }

        return 'Unknown Model';
    }

    _detectFormat(model) {
        // 支援 ONNX 模型的私有屬性結構
        if (model._format) {
            return model._format.toLowerCase();
        }
        if (model.format) {
            return model.format.toLowerCase();
        }

        // 從識別碼推斷格式
        if (model.identifier) {
            const ext = model.identifier.split('.').pop().toLowerCase();
            const formatMap = {
                'onnx': 'onnx',
                'pb': 'tensorflow',
                'tflite': 'tflite',
                'mlmodel': 'coreml'
            };
            return formatMap[ext] || 'unknown';
        }

        return 'unknown';
    }

    _extractInputs(graph) {
        const inputs = [];

        console.log('🔍 [ModelSummarizer] 分析輸入張量...');
        console.log('🔍 [ModelSummarizer] graph.inputs:', graph.inputs);

        if (graph.inputs) {
            for (const input of graph.inputs) {
                console.log('🔍 [ModelSummarizer] 單個輸入張量:', input);
                console.log('🔍 [ModelSummarizer] 輸入張量屬性:', Object.keys(input));
                console.log('🔍 [ModelSummarizer] 輸入張量 type:', input.type);

                const shape = this._parseShape(input);
                const domain = this._guessDomain(input);
                const isDomainInferred = domain === 'unknown' || this._isDomainGuessed(input);

                console.log('🔍 [ModelSummarizer] 解析結果 - shape:', shape, 'dtype:', this._parseDtype(input));

                inputs.push({
                    name: input.name || 'input',
                    shape,
                    dtype: this._parseDtype(input),
                    domain,
                    provenance: isDomainInferred ? 'inferred' : 'model',
                    confidence: isDomainInferred ? this._calculateDomainConfidence(input, domain) : 1.0
                });
            }
        }

        return inputs;
    }

    _extractOutputs(graph) {
        const outputs = [];

        console.log('🔍 [ModelSummarizer] 分析輸出張量...');
        console.log('🔍 [ModelSummarizer] graph.outputs:', graph.outputs);

        if (graph.outputs) {
            for (const output of graph.outputs) {
                console.log('🔍 [ModelSummarizer] 單個輸出張量:', output);
                console.log('🔍 [ModelSummarizer] 輸出張量屬性:', Object.keys(output));
                console.log('🔍 [ModelSummarizer] 輸出張量 type:', output.type);

                const semantics = this._guessSemantics(output);
                const isSemanticsInferred = semantics === 'unknown' || this._isSemanticsGuessed(output);

                console.log('🔍 [ModelSummarizer] 解析結果 - shape:', this._parseShape(output), 'dtype:', this._parseDtype(output));

                outputs.push({
                    name: output.name || 'output',
                    shape: this._parseShape(output),
                    dtype: this._parseDtype(output),
                    semantics,
                    provenance: isSemanticsInferred ? 'inferred' : 'model',
                    confidence: isSemanticsInferred ? this._calculateSemanticsConfidence(output, semantics) : 1.0
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
            Object.prototype.hasOwnProperty.call(summary.operators.types, op)
        );

        return hasMatchingOutput || hasMatchingShape || hasMatchingOps;
    }

    _parseShape(tensor) {
        console.log('🔧 [ModelSummarizer] 解析形狀，張量:', tensor);

        // 嘗試多種 ONNX 張量結構
        // 1. 標準結構: tensor.type.shape.dimensions
        if (tensor.type?.shape?.dimensions) {
            const dims = tensor.type.shape.dimensions.map((dim) => {
                if (typeof dim === 'object' && dim.size !== undefined) {
                    return dim.size;
                }
                return dim || '?';
            });
            console.log('🔧 [ModelSummarizer] 從 type.shape.dimensions 獲得形狀:', dims);
            return dims;
        }

        // 2. 嘗試直接從 shape 屬性
        if (tensor.shape) {
            const dims = Array.isArray(tensor.shape) ? tensor.shape : [tensor.shape];
            console.log('🔧 [ModelSummarizer] 從 shape 屬性獲得形狀:', dims);
            return dims;
        }

        // 3. 嘗試從 _type 私有屬性
        if (tensor._type?.shape?.dimensions) {
            const dims = tensor._type.shape.dimensions.map((dim) => {
                if (typeof dim === 'object' && dim.size !== undefined) {
                    return dim.size;
                }
                return dim || '?';
            });
            console.log('🔧 [ModelSummarizer] 從 _type.shape.dimensions 獲得形狀:', dims);
            return dims;
        }

        // 4. 嘗試從 arguments 獲得（某些 ONNX 版本）
        if (tensor.arguments && tensor.arguments.length > 0) {
            const arg = tensor.arguments[0];
            if (arg.type?.shape?.dimensions) {
                const dims = arg.type.shape.dimensions.map((dim) => {
                    if (typeof dim === 'object' && dim.size !== undefined) {
                        return dim.size;
                    }
                    return dim || '?';
                });
                console.log('🔧 [ModelSummarizer] 從 arguments 獲得形狀:', dims);
                return dims;
            }
        }

        console.log('🔧 [ModelSummarizer] 無法解析形狀，返回空陣列');
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
        const hasQuantOps = quantOps.some((op) => Object.prototype.hasOwnProperty.call(ops.types, op));

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

    /**
     * 帶置信度的任務推斷
     */
    _guessTaskWithConfidence(model, graph) {
        const summary = {
            inputs: this._extractInputs(graph),
            outputs: this._extractOutputs(graph),
            operators: this._analyzeOperators(graph)
        };

        let bestMatch = 'unknown';
        let maxConfidence = 0.0;

        for (const [taskType, pattern] of Object.entries(this.taskPatterns)) {
            const confidence = this._calculateTaskConfidence(summary, pattern);
            if (confidence > maxConfidence) {
                maxConfidence = confidence;
                bestMatch = taskType;
            }
        }

        return {
            value: bestMatch,
            provenance: 'heuristic',
            confidence: maxConfidence
        };
    }

    /**
     * 計算任務類型的置信度
     */
    _calculateTaskConfidence(summary, pattern) {
        let score = 0.0;
        let factors = 0;

        // 檢查輸出名稱匹配
        const hasMatchingOutput = summary.outputs.some((output) =>
            pattern.outputs.test(output.name)
        );
        if (hasMatchingOutput) {
            score += 0.4;
        }
        factors++;

        // 檢查輸出形狀匹配
        const hasMatchingShape = summary.outputs.some((output) =>
            pattern.shapes.some((shapePattern) =>
                shapePattern.test(JSON.stringify(output.shape))
            )
        );
        if (hasMatchingShape) {
            score += 0.4;
        }
        factors++;

        // 檢查操作符匹配
        const hasMatchingOps = pattern.ops.some((op) =>
            Object.prototype.hasOwnProperty.call(summary.operators.types, op)
        );
        if (hasMatchingOps) {
            score += 0.2;
        }
        factors++;

        return factors > 0 ? score / factors : 0.0;
    }

    /**
     * 帶來源信息的量化檢測
     */
    _checkQuantizationWithProvenance(graph) {
        const quantOps = ['QuantizeLinear', 'DequantizeLinear', 'Q', 'DQ'];
        const foundOps = [];

        let isQuantized = false;
        let precision = 'fp32';

        if (graph.nodes) {
            for (const node of graph.nodes) {
                const opType = node.type || node.op_type;
                if (quantOps.includes(opType)) {
                    isQuantized = true;
                    foundOps.push(opType);
                    precision = 'int8'; // 假設為 int8 量化
                }
            }
        }

        return {
            isQuantized,
            precision,
            observed: foundOps,
            provenance: 'graph_scan',
            confidence: isQuantized ? 0.9 : 1.0
        };
    }

    /**
     * 檢查 domain 是否為推斷的
     */
    _isDomainGuessed(input) {
        const shape = this._parseShape(input);
        const name = input.name?.toLowerCase() || '';

        // 如果只能根據形狀或名稱推斷，則認為是推斷的
        return !(name.includes('image') || name.includes('pixel') ||
                name.includes('text') || name.includes('token') ||
                (shape.length === 4 && (shape[1] === 3 || shape[3] === 3)));
    }

    /**
     * 計算 domain 推斷的置信度
     */
    _calculateDomainConfidence(input, domain) {
        const shape = this._parseShape(input);
        const name = input.name?.toLowerCase() || '';

        if (domain === 'unknown') {
            return 0.1;
        }

        let confidence = 0.5; // 基礎置信度

        // 名稱匹配增加置信度
        if (name.includes('image') && domain === 'image') {
            confidence += 0.3;
        }
        if (name.includes('text') && domain === 'text') {
            confidence += 0.3;
        }

        // 形狀匹配增加置信度
        if (shape.length === 4 && domain === 'image') {
            confidence += 0.2;
        }
        if (shape.length === 2 && domain === 'tabular') {
            confidence += 0.2;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * 檢查 semantics 是否為推斷的
     */
    _isSemanticsGuessed(output) {
        const name = output.name?.toLowerCase() || '';

        // 如果名稱明確包含語意關鍵字，則不是推斷的
        return !(name.includes('box') || name.includes('class') ||
                name.includes('mask') || name.includes('keypoint') ||
                name.includes('score') || name.includes('logit'));
    }

    /**
     * 計算 semantics 推斷的置信度
     */
    _calculateSemanticsConfidence(output, semantics) {
        const shape = this._parseShape(output);
        const name = output.name?.toLowerCase() || '';

        if (semantics === 'unknown') {
            return 0.1;
        }

        let confidence = 0.4; // 基礎置信度

        // 名稱匹配增加置信度
        if (name.includes('box') && semantics === 'bounding_boxes') {
            confidence += 0.4;
        }
        if (name.includes('class') && semantics === 'classification') {
            confidence += 0.4;
        }
        if (name.includes('mask') && semantics === 'segmentation_mask') {
            confidence += 0.4;
        }

        // 形狀匹配增加置信度
        if (shape.length === 2 && shape[1] < 10000 && semantics === 'logits') {
            confidence += 0.2;
        }
        if (shape[shape.length - 1] === 4 && semantics === 'bounding_boxes') {
            confidence += 0.3;
        }

        return Math.min(confidence, 1.0);
    }

}
