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
        // 通用格式檢測 - 支援所有主流 AI 模型格式
        const formatDetectors = [
            // 直接從模型屬性檢測
            () => model._format?.toLowerCase(),
            () => model.format?.toLowerCase(),
            () => model.modelFormat?.toLowerCase(),
            () => model.type?.toLowerCase(),

            // 從識別碼或檔案路徑檢測
            () => {
                if (model.identifier) {
                    const ext = model.identifier.split('.').pop()?.toLowerCase();
                    const formatMap = {
                        'onnx': 'onnx',
                        'pb': 'tensorflow',
                        'pbtxt': 'tensorflow',
                        'tflite': 'tflite',
                        'mlmodel': 'coreml',
                        'pth': 'pytorch',
                        'pt': 'pytorch',
                        'torchscript': 'pytorch',
                        'h5': 'keras',
                        'hdf5': 'keras',
                        'json': 'tensorflow.js',
                        'caffemodel': 'caffe',
                        'prototxt': 'caffe',
                        'engine': 'tensorrt',
                        'plan': 'tensorrt',
                        'xml': 'openvino',
                        'bin': 'openvino'
                    };
                    return formatMap[ext];
                }
                return null;
            },

            // 從模型結構特徵檢測
            () => {
                if (model._producer?.includes('tf2onnx') || model._producer?.includes('pytorch')) {
                    return 'onnx';
                }
                if (model.savedModelSchema) {
                    return 'tensorflow';
                }
                if (model.description?.includes('TensorFlow Lite')) {
                    return 'tflite';
                }
                return null;
            },

            // 從版本資訊檢測
            () => {
                if (model._version || model.version) {
                    const version = model._version || model.version;
                    if (version.includes('ONNX')) {
                        return 'onnx';
                    }
                    if (version.includes('TensorFlow')) {
                        return 'tensorflow';
                    }
                    if (version.includes('PyTorch')) {
                        return 'pytorch';
                    }
                }
                return null;
            }
        ];

        // 嘗試每個檢測器
        for (const detector of formatDetectors) {
            try {
                const result = detector();
                if (result && result !== 'unknown') {
                    return this._normalizeFormat(result);
                }
            } catch (error) {
                continue;
            }
        }

        return 'unknown';
    }

    _normalizeFormat(format) {
        // 標準化格式名稱
        const normalized = format.toLowerCase().trim();

        // 格式別名對應
        const aliases = {
            'tf': 'tensorflow',
            'pb': 'tensorflow',
            'saved_model': 'tensorflow',
            'tflite': 'tensorflow lite',
            'torch': 'pytorch',
            'pth': 'pytorch',
            'pt': 'pytorch',
            'torchscript': 'pytorch',
            'keras': 'keras/tensorflow',
            'h5': 'keras/tensorflow',
            'core_ml': 'coreml',
            'mlmodel': 'coreml',
            'tensorrt': 'tensorrt',
            'trt': 'tensorrt',
            'openvino': 'openvino ir',
            'ir': 'openvino ir',
            'caffe': 'caffe',
            'darknet': 'darknet',
            'mxnet': 'mxnet',
            'paddle': 'paddlepaddle'
        };

        return aliases[normalized] || normalized;
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

        // 通用形狀解析策略 - 支援所有模型格式
        const shapeExtractors = [
            // ONNX 格式
            () => tensor.type?.shape?.dimensions?.map(this._normalizeDimension),
            () => tensor._type?.shape?.dimensions?.map(this._normalizeDimension),

            // TensorFlow 格式
            () => tensor.shape?.dimensions?.map(this._normalizeDimension),
            () => tensor.tensorShape?.dim?.map((dim) => this._normalizeDimension(dim)),
            () => tensor.type?.shape?.dim?.map(this._normalizeDimension),

            // TFLite 格式
            () => tensor.shape,
            () => tensor.shapeSignature,

            // PyTorch 格式
            () => tensor.size,
            () => tensor.shape,

            // CoreML 格式
            () => tensor.type?.multiArrayType?.shape,
            () => tensor.multiArrayType?.shape,

            // 通用格式
            () => Array.isArray(tensor.shape) ? tensor.shape : [tensor.shape],
            () => tensor.dimensions,
            () => tensor.size && Array.isArray(tensor.size) ? tensor.size : null,

            // Arguments-based 格式 (某些包裝器)
            () => {
                if (tensor.arguments && tensor.arguments.length > 0) {
                    const arg = tensor.arguments[0];
                    return arg.type?.shape?.dimensions?.map(this._normalizeDimension) ||
                           arg.shape ||
                           arg.size;
                }
                return null;
            }
        ];

        // 嘗試每個提取器
        for (const extractor of shapeExtractors) {
            try {
                const result = extractor();
                if (result && Array.isArray(result) && result.length > 0) {
                    const normalizedShape = result.map((dim) => this._normalizeDimension(dim));
                    console.log('🔧 [ModelSummarizer] 成功解析形狀:', normalizedShape);
                    return normalizedShape;
                }
            } catch (error) {
                // 忽略提取器錯誤，繼續嘗試下一個
                continue;
            }
        }

        console.log('🔧 [ModelSummarizer] 無法解析形狀，返回空陣列');
        return [];
    }

    _normalizeDimension(dim) {
        // 標準化維度值 - 處理不同格式的維度表示
        if (typeof dim === 'number') {
            return dim;
        }
        if (typeof dim === 'object') {
            // ONNX 格式: {size: number}
            if (dim.size !== undefined) {
                return dim.size;
            }
            // TensorFlow 格式: {value: number}
            if (dim.value !== undefined) {
                return dim.value;
            }
            // 其他可能的屬性
            if (dim.dim !== undefined) {
                return dim.dim;
            }
        }
        if (typeof dim === 'string') {
            // 嘗試轉換字串數字
            const parsed = parseInt(dim, 10);
            return isNaN(parsed) ? '?' : parsed;
        }
        // 未知或動態維度
        return dim === null || dim === undefined ? '?' : dim;
    }

    _parseDtype(tensor) {
        console.log('🔧 [ModelSummarizer] 解析資料類型，張量:', tensor);

        // 通用資料類型解析策略 - 支援所有模型格式
        const dtypeExtractors = [
            // ONNX 格式
            () => tensor.type?.dataType,
            () => tensor._type?.dataType,
            () => tensor.type?.tensorType?.elemType,

            // TensorFlow 格式
            () => tensor.dtype,
            () => tensor.dataType,
            () => tensor.type?.dtype,
            () => tensor.attr?.dtype?.type,

            // TFLite 格式
            () => tensor.type,
            () => tensor.dataType,

            // PyTorch 格式
            () => tensor.dtype,
            () => tensor.scalar_type,
            () => tensor.data_type,

            // CoreML 格式
            () => tensor.type?.multiArrayType?.dataType,
            () => tensor.multiArrayType?.dataType,

            // 通用格式
            () => tensor.elementType,
            () => tensor.element_type,
            () => tensor.valueType,
            () => tensor.value_type,

            // Arguments-based 格式
            () => {
                if (tensor.arguments && tensor.arguments.length > 0) {
                    const [arg] = tensor.arguments;
                    return arg.type?.dataType ||
                           arg.dtype ||
                           arg.dataType ||
                           arg.type?.dtype;
                }
                return null;
            }
        ];

        // 嘗試每個提取器
        for (const extractor of dtypeExtractors) {
            try {
                const result = extractor();
                if (result) {
                    const normalizedType = this._normalizeDtype(result);
                    console.log('🔧 [ModelSummarizer] 成功解析資料類型:', normalizedType);
                    return normalizedType;
                }
            } catch (error) {
                // 忽略提取器錯誤，繼續嘗試下一個
                continue;
            }
        }

        console.log('🔧 [ModelSummarizer] 無法解析資料類型，返回 unknown');
        return 'unknown';
    }

    _normalizeDtype(dtype) {
        // 標準化資料類型名稱 - 統一不同格式的類型表示
        if (typeof dtype === 'number') {
            // ONNX/TensorFlow 數字編碼
            const typeMap = {
                1: 'float32',     // ONNX FLOAT
                2: 'uint8',       // ONNX UINT8
                3: 'int8',        // ONNX INT8
                4: 'uint16',      // ONNX UINT16
                5: 'int16',       // ONNX INT16
                6: 'int32',       // ONNX INT32
                7: 'int64',       // ONNX INT64
                8: 'string',      // ONNX STRING
                9: 'bool',        // ONNX BOOL
                10: 'float16',    // ONNX FLOAT16
                11: 'float64',    // ONNX DOUBLE
                12: 'uint32',     // ONNX UINT32
                13: 'uint64',     // ONNX UINT64
            };
            return typeMap[dtype] || `type_${dtype}`;
        }

        if (typeof dtype === 'string') {
            // 標準化字串類型名稱
            const normalized = dtype.toLowerCase()
                .replace(/^dt_/, '')        // TensorFlow DT_ prefix
                .replace(/^tensor_/, '')    // 某些格式的 TENSOR_ prefix
                .replace(/_t$/, '');        // 某些格式的 _T suffix

            // 統一常見類型名稱
            const typeAliases = {
                'float': 'float32',
                'double': 'float64',
                'int': 'int32',
                'long': 'int64',
                'byte': 'uint8',
                'short': 'int16',
                'half': 'float16',
                'boolean': 'bool',
            };

            return typeAliases[normalized] || normalized;
        }

        return String(dtype);
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
        // 通用任務推測 - 基於多種特徵綜合判斷
        const features = {
            modelName: (model.identifier || model.name || '').toLowerCase(),
            format: this._detectFormat(model),
            inputs: this._extractInputs(graph),
            outputs: this._extractOutputs(graph),
            operators: this._analyzeOperators(graph)
        };

        console.log('🎯 [ModelSummarizer] 任務推測特徵:', features);

        const taskAnalyzers = [
            () => this._analyzeByName(features.modelName),
            () => this._analyzeByInputOutput(features.inputs, features.outputs),
            () => this._analyzeByOperators(features.operators),
            () => this._analyzeByShapePattern(features.inputs, features.outputs),
        ];

        let bestGuess = { value: 'unknown', confidence: 0, provenance: 'heuristic' };

        for (const analyzer of taskAnalyzers) {
            try {
                const result = analyzer();
                if (result && result.confidence > bestGuess.confidence) {
                    bestGuess = { ...result, provenance: 'heuristic' };
                }
            } catch (error) {
                continue;
            }
        }

        console.log('🎯 [ModelSummarizer] 最終任務推測:', bestGuess);
        return bestGuess;
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

    _analyzeByName(modelName) {
        // 根據模型名稱推測任務
        const namePatterns = [
            { pattern: /(classification|classifier|cls)/i, task: 'classification', confidence: 0.8 },
            { pattern: /(detection|detect|yolo|ssd|rcnn)/i, task: 'detection', confidence: 0.9 },
            { pattern: /(segmentation|segment|seg|mask)/i, task: 'segmentation', confidence: 0.9 },
            { pattern: /(pose|keypoint|landmark)/i, task: 'pose_estimation', confidence: 0.9 },
            { pattern: /(face|facial)/i, task: 'face_analysis', confidence: 0.8 },
            { pattern: /(text|nlp|language|bert|gpt|transformer)/i, task: 'nlp', confidence: 0.8 },
            { pattern: /(gan|generator|discriminator)/i, task: 'generation', confidence: 0.8 },
            { pattern: /(speech|audio|asr|tts)/i, task: 'audio', confidence: 0.8 },
            { pattern: /(recommendation|recommender)/i, task: 'recommendation', confidence: 0.8 }
        ];

        for (const { pattern, task, confidence } of namePatterns) {
            if (pattern.test(modelName)) {
                return { value: task, confidence };
            }
        }

        return null;
    }

    _analyzeByInputOutput(inputs, outputs) {
        // 根據輸入輸出特徵推測任務
        if (inputs.length === 0 || outputs.length === 0) {
            return null;
        }

        const inputShapes = inputs.map((input) => input.shape);
        const outputShapes = outputs.map((output) => output.shape);

        // 圖像相關任務
        const hasImageInput = inputShapes.some((shape) =>
            shape.length >= 3 && (shape[1] === 3 || shape[3] === 3 ||
            (shape.length === 4 && shape[1] >= 224 && shape[2] >= 224))
        );

        if (hasImageInput) {
            // 分類：輸出是1D或包含類別數
            if (outputs.length === 1 && outputShapes[0].length <= 2) {
                const lastDim = outputShapes[0][outputShapes[0].length - 1];
                if (typeof lastDim === 'number' && lastDim > 1 && lastDim <= 10000) {
                    return { value: 'classification', confidence: 0.8 };
                }
            }

            // 檢測：多個輸出包含邊界框
            if (outputs.length >= 2) {
                const hasBboxOutput = outputShapes.some((shape) =>
                    shape.length >= 2 && shape[shape.length - 1] === 4
                );
                if (hasBboxOutput) {
                    return { value: 'detection', confidence: 0.9 };
                }
            }

            // 語義分割：輸出形狀類似輸入但通道數為類別數
            const hasSegmentationOutput = outputShapes.some((shape) =>
                shape.length >= 3 && shape[shape.length - 2] > 100 && shape[shape.length - 3] > 100
            );
            if (hasSegmentationOutput) {
                return { value: 'segmentation', confidence: 0.8 };
            }

            // 姿態估計：輸出包含關鍵點
            const hasPoseOutput = outputShapes.some((shape) => {
                const lastDim = shape[shape.length - 1];
                return typeof lastDim === 'number' && (lastDim === 17 || lastDim === 34 || lastDim === 51);
            });
            if (hasPoseOutput) {
                return { value: 'pose_estimation', confidence: 0.9 };
            }
        }

        // 文字/序列相關任務
        const hasSequenceInput = inputShapes.some((shape) =>
            shape.length === 2 || (shape.length === 3 && shape[2] < 1000)
        );

        if (hasSequenceInput && !hasImageInput) {
            return { value: 'nlp', confidence: 0.7 };
        }

        return null;
    }

    _analyzeByOperators(operators) {
        // 根據運算子類型推測任務
        if (!operators || !operators.types) {
            return null;
        }

        const opTypes = Object.keys(operators.types);
        const opCounts = operators.types;

        // 檢測關鍵運算子
        const hasConv = opTypes.some((op) => op.toLowerCase().includes('conv'));
        const hasPool = opTypes.some((op) => op.toLowerCase().includes('pool'));
        const hasLSTM = opTypes.some((op) => op.toLowerCase().includes('lstm'));
        const hasAttention = opTypes.some((op) => op.toLowerCase().includes('attention'));
        const hasNMS = opTypes.some((op) => op.toLowerCase().includes('nms'));

        if (hasNMS) {
            return { value: 'detection', confidence: 0.9 };
        }

        if (hasConv && hasPool) {
            return { value: 'computer_vision', confidence: 0.7 };
        }

        if (hasLSTM || hasAttention) {
            return { value: 'nlp', confidence: 0.8 };
        }

        return null;
    }

    _analyzeByShapePattern(inputs, outputs) {
        // 根據形狀模式推測任務
        const inputShapes = inputs.map((i) => i.shape).filter((s) => s.length > 0);
        const outputShapes = outputs.map((o) => o.shape).filter((s) => s.length > 0);

        if (inputShapes.length === 0 || outputShapes.length === 0) {
            return null;
        }

        // 常見的形狀模式
        const patterns = [
            {
                // 圖像分類：[N, C, H, W] -> [N, Classes]
                condition: () => {
                    return inputShapes.some((s) => s.length === 4) &&
                           outputShapes.some((s) => s.length <= 2);
                },
                task: 'classification',
                confidence: 0.7
            },
            {
                // 語音識別：[N, Time, Features] -> [N, Time, Vocab]
                condition: () => {
                    return inputShapes.some((s) => s.length === 3 && s[2] < 100) &&
                           outputShapes.some((s) => s.length === 3 && s[2] > 100);
                },
                task: 'speech_recognition',
                confidence: 0.8
            }
        ];

        for (const pattern of patterns) {
            if (pattern.condition()) {
                return { value: pattern.task, confidence: pattern.confidence };
            }
        }

        return null;
    }

}
