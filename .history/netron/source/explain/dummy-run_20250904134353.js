/**
 * Dummy Runner - 在瀏覽器中執行模型推理測試
 * 使用隨機輸入測試模型，獲取實際輸出形狀和性能指標
 */

export class DummyRunner {
    constructor() {
        this.ort = null;
        this.isInitialized = false;
    }

    /**
     * 初始化 ONNX Runtime Web
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // 動態載入 ONNX Runtime Web
            if (typeof window === 'undefined') {
                // Node.js 環境
                this.ort = await import('onnxruntime-web');
            } else {
                // 瀏覽器環境
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js';
                document.head.appendChild(script);

                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                });

                this.ort = window.ort;
            }

            this.isInitialized = true;
            // eslint-disable-next-line no-console
            console.log('ONNX Runtime Web 初始化成功');
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('ONNX Runtime Web 載入失敗:', error);
            throw new Error('無法載入 ONNX Runtime Web，dummy run 功能不可用');
        }
    }

    /**
     * 執行模型推理測試
     * @param {ArrayBuffer} modelBuffer - 模型二進位數據
     * @param {Object} summary - 模型摘要資訊
     * @returns {Object} 執行結果
     */
    async runModel(modelBuffer, summary) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (summary.format.toLowerCase() !== 'onnx') {
            throw new Error(`目前僅支援 ONNX 模型，收到格式: ${summary.format}`);
        }

        try {
            // eslint-disable-next-line no-console
            console.log('開始載入 ONNX 模型...');
            const session = await this.ort.InferenceSession.create(modelBuffer);

            // eslint-disable-next-line no-console
            console.log('模型載入成功，準備輸入數據...');
            const inputs = this._prepareInputs(summary.inputs);

            // eslint-disable-next-line no-console
            console.log('開始推理...');
            const startTime = performance.now();
            const outputs = await session.run(inputs);
            const endTime = performance.now();

            const result = {
                success: true,
                inferenceTime: endTime - startTime,
                inputs: this._analyzeInputs(inputs),
                outputs: this._analyzeOutputs(outputs),
                memoryUsage: this._estimateMemoryUsage(inputs, outputs),
                metadata: {
                    provider: session.sessionOptions?.executionProviders || ['cpu'],
                    inputNames: session.inputNames,
                    outputNames: session.outputNames
                }
            };

            // eslint-disable-next-line no-console
            console.log('推理完成:', result);
            return result;

        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('模型執行失敗:', error);
            return {
                success: false,
                error: error.message,
                details: error.stack
            };
        }
    }

    /**
     * 根據輸入規格準備隨機測試數據
     * @param {Array} inputSpecs - 輸入規格陣列
     * @returns {Object} 輸入張量字典
     */
    _prepareInputs(inputSpecs) {
        const inputs = {};

        for (const spec of inputSpecs) {
            const shape = this._resolveShape(spec.shape);
            const data = this._generateRandomData(shape, spec.dtype);
            const tensor = new this.ort.Tensor(this._mapDataType(spec.dtype), data, shape);
            inputs[spec.name] = tensor;
        }

        return inputs;
    }

    /**
     * 解析動態形狀，替換為具體數值
     * @param {Array} shape - 原始形狀陣列
     * @returns {Array} 解析後的形狀
     */
    _resolveShape(shape) {
        return shape.map((dim) => {
            if (dim === '?' || dim === -1 || dim === null || dim === undefined) {
                return 1; // 動態維度設為 1
            }
            if (typeof dim === 'string' && isNaN(parseInt(dim))) {
                return 1; // 符號維度設為 1
            }
            return parseInt(dim) || 1;
        });
    }

    /**
     * 生成隨機測試數據
     * @param {Array} shape - 張量形狀
     * @param {string} dtype - 數據類型
     * @returns {TypedArray} 隨機數據
     */
    _generateRandomData(shape, dtype) {
        const size = shape.reduce((a, b) => a * b, 1);

        switch (dtype.toLowerCase()) {
            case 'float32':
            case 'float':
                return new Float32Array(size).map(() => Math.random());

            case 'float64':
            case 'double':
                return new Float64Array(size).map(() => Math.random());

            case 'int32':
            case 'int':
                return new Int32Array(size).map(() => Math.floor(Math.random() * 256));

            case 'int64':
            case 'long':
                return new BigInt64Array(size).map(() => BigInt(Math.floor(Math.random() * 256)));

            case 'uint8':
            case 'byte':
                return new Uint8Array(size).map(() => Math.floor(Math.random() * 256));

            case 'int8':
                return new Int8Array(size).map(() => Math.floor(Math.random() * 256) - 128);

            case 'uint16':
                return new Uint16Array(size).map(() => Math.floor(Math.random() * 65536));

            case 'int16':
                return new Int16Array(size).map(() => Math.floor(Math.random() * 65536) - 32768);

            case 'bool':
            case 'boolean':
                return new Uint8Array(size).map(() => Math.random() > 0.5 ? 1 : 0);

            default:
                console.warn(`未知數據類型 ${dtype}，使用 Float32Array`);
                return new Float32Array(size).map(() => Math.random());
        }
    }

    /**
     * 映射數據類型到 ONNX Runtime 格式
     * @param {string} dtype - 原始數據類型
     * @returns {string} ONNX Runtime 數據類型
     */
    _mapDataType(dtype) {
        const typeMap = {
            'float32': 'float32',
            'float': 'float32',
            'float64': 'float64',
            'double': 'float64',
            'int32': 'int32',
            'int': 'int32',
            'int64': 'int64',
            'long': 'int64',
            'uint8': 'uint8',
            'byte': 'uint8',
            'int8': 'int8',
            'uint16': 'uint16',
            'int16': 'int16',
            'bool': 'bool',
            'boolean': 'bool'
        };

        return typeMap[dtype.toLowerCase()] || 'float32';
    }

    /**
     * 分析輸入數據
     * @param {Object} inputs - 輸入張量字典
     * @returns {Array} 輸入分析結果
     */
    _analyzeInputs(inputs) {
        const analysis = [];

        for (const [name, tensor] of Object.entries(inputs)) {
            analysis.push({
                name,
                shape: Array.from(tensor.dims),
                dtype: tensor.type,
                size: tensor.size,
                min: this._getTensorMin(tensor.data),
                max: this._getTensorMax(tensor.data),
                mean: this._getTensorMean(tensor.data)
            });
        }

        return analysis;
    }

    /**
     * 分析輸出數據
     * @param {Object} outputs - 輸出張量字典
     * @returns {Array} 輸出分析結果
     */
    _analyzeOutputs(outputs) {
        const analysis = [];

        for (const [name, tensor] of Object.entries(outputs)) {
            analysis.push({
                name,
                shape: Array.from(tensor.dims),
                dtype: tensor.type,
                size: tensor.size,
                min: this._getTensorMin(tensor.data),
                max: this._getTensorMax(tensor.data),
                mean: this._getTensorMean(tensor.data),
                sample: this._getSampleValues(tensor.data, 10)
            });
        }

        return analysis;
    }

    /**
     * 估算記憶體使用量
     * @param {Object} inputs - 輸入張量
     * @param {Object} outputs - 輸出張量
     * @returns {Object} 記憶體使用統計
     */
    _estimateMemoryUsage(inputs, outputs) {
        let inputMemory = 0;
        let outputMemory = 0;

        for (const tensor of Object.values(inputs)) {
            inputMemory += this._getTensorMemorySize(tensor);
        }

        for (const tensor of Object.values(outputs)) {
            outputMemory += this._getTensorMemorySize(tensor);
        }

        return {
            input: inputMemory,
            output: outputMemory,
            total: inputMemory + outputMemory,
            unit: 'bytes'
        };
    }

    /**
     * 計算張量記憶體大小
     * @param {Tensor} tensor - ONNX 張量
     * @returns {number} 記憶體大小（位元組）
     */
    _getTensorMemorySize(tensor) {
        const bytesPerElement = {
            'float32': 4,
            'float64': 8,
            'int32': 4,
            'int64': 8,
            'uint8': 1,
            'int8': 1,
            'uint16': 2,
            'int16': 2,
            'bool': 1
        };

        return tensor.size * (bytesPerElement[tensor.type] || 4);
    }

    /**
     * 獲取張量最小值
     */
    _getTensorMin(data) {
        return Math.min(...Array.from(data));
    }

    /**
     * 獲取張量最大值
     */
    _getTensorMax(data) {
        return Math.max(...Array.from(data));
    }

    /**
     * 獲取張量平均值
     */
    _getTensorMean(data) {
        const sum = Array.from(data).reduce((a, b) => a + b, 0);
        return sum / data.length;
    }

    /**
     * 獲取張量樣本值
     * @param {TypedArray} data - 張量數據
     * @param {number} count - 樣本數量
     * @returns {Array} 樣本值陣列
     */
    _getSampleValues(data, count = 10) {
        const samples = [];
        const step = Math.max(1, Math.floor(data.length / count));

        for (let i = 0; i < data.length && samples.length < count; i += step) {
            samples.push(data[i]);
        }

        return samples;
    }

    /**
     * 檢查是否支援 ONNX Runtime Web
     * @returns {boolean} 是否支援
     */
    static isSupported() {
        return typeof WebAssembly !== 'undefined' &&
               typeof Worker !== 'undefined' &&
               typeof fetch !== 'undefined';
    }

    /**
     * 獲取支援的執行提供者
     * @returns {Array} 執行提供者列表
     */
    static getSupportedProviders() {
        const providers = ['cpu'];

        // 檢查 WebGL 支援
        if (typeof WebGLRenderingContext !== 'undefined') {
            providers.push('webgl');
        }

        // 檢查 WebGPU 支援
        if (typeof navigator !== 'undefined' && navigator.gpu) {
            providers.push('webgpu');
        }

        return providers;
    }
}
