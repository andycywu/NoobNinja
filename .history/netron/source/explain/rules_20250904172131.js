/**
 * Rules Engine - 基於規則產生白話說明（不依賴 LLM）
 * 根據模型摘要生成用戶友好的解釋
 */

export class RulesEngine {
    constructor() {
        this.taskTemplates = {
            classification: {
                purpose: '這是一個{format}格式的圖像分類模型',
                applications: ['圖像識別', '物體分類', '場景理解', '品質控制']
            },
            detection: {
                purpose: '這是一個{format}格式的物體檢測模型',
                applications: ['物體檢測', '安防監控', '自動駕駛', '智能零售']
            },
            segmentation: {
                purpose: '這是一個{format}格式的圖像分割模型',
                applications: ['醫學影像', '自動駕駛', '影像編輯', '場景分析']
            },
            nlp: {
                purpose: '這是一個{format}格式的自然語言處理模型',
                applications: ['文本分析', '情感分析', '機器翻譯', '問答系統']
            },
            unknown: {
                purpose: '這是一個{format}格式的機器學習模型',
                applications: ['數據預測', '模式識別', '自動化分析']
            }
        };
    }

    /**
     * 產生模型解釋
     * @param {Object} summary - 模型摘要
     * @returns {Object} 白話說明
     */
    generateExplanation(summary) {
        // 處理新的 taskGuess 格式 (可能是對象或字符串)
        const taskType = typeof summary.taskGuess === 'object'
            ? summary.taskGuess.value
            : summary.taskGuess;

        const template = this.taskTemplates[taskType] || this.taskTemplates.unknown;

        return {
            purpose: this._generatePurpose(summary, template),
            inputRequirements: this._generateInputRequirements(summary),
            outputMeaning: this._generateOutputMeaning(summary),
            applications: this._generateApplications(summary, template),
            quickstartCode: this._generateQuickstartCode(summary),
            limitations: this._generateLimitations(summary),
            performance: this._generatePerformanceNotes(summary)
        };
    }

    _generatePurpose(summary, template) {
        let purpose = template.purpose;

        // 替換變數，添加安全檢查
        purpose = purpose.replace('{format}', summary.format?.toUpperCase() || 'UNKNOWN');
        purpose = purpose.replace('{precision}', summary.quantization?.precision || 'fp32');
        purpose = purpose.replace('{modelName}', summary.modelName || '未知模型');

        return purpose;
    }

    _generateInputRequirements(summary) {
        const requirements = [];

        for (const input of summary.inputs || []) {
            const req = {
                name: input.name,
                shape: input.shape,
                dtype: input.dtype,
                domain: input.domain,
                description: this._describeInput(input),
                preprocessing: this._suggestPreprocessing(input)
            };
            requirements.push(req);
        }

        return requirements;
    }

    _generateOutputMeaning(summary) {
        const meanings = [];

        const taskType = typeof summary.taskGuess === 'object'
            ? summary.taskGuess.value
            : summary.taskGuess;

        for (const output of summary.outputs || []) {
            const meaning = {
                name: output.name,
                shape: output.shape,
                dtype: output.dtype,
                semantics: output.semantics,
                description: this._describeOutput(output, taskType),
                postprocessing: this._suggestPostprocessing(output, taskType)
            };
            meanings.push(meaning);
        }

        return meanings;
    }

    _generateApplications(summary, template) {
        return template.applications;
    }

    _generateQuickstartCode(summary) {
        const format = summary.format?.toLowerCase() || 'unknown';

        switch (format) {
            case 'onnx':
                return this._generateONNXCode(summary);
            case 'tflite':
                return this._generateTFLiteCode(summary);
            case 'coreml':
                return this._generateCoreMLCode(summary);
            default:
                return this._generateGenericCode(summary);
        }
    }

    _generateLimitations(summary) {
        const limitations = [];

        // 基於格式的限制
        if (summary.quantization?.isQuantized) {
            limitations.push('量化模型可能會有精度損失');
        }

        // 基於任務的限制
        const taskType = typeof summary.taskGuess === 'object'
            ? summary.taskGuess.value
            : summary.taskGuess;

        switch (taskType) {
            case 'classification':
                limitations.push('僅適用於預設類別範圍內的分類');
                break;
            case 'detection':
                limitations.push('檢測精度取決於訓練數據品質');
                break;
        }

        return limitations;
    }

    _generatePerformanceNotes(summary) {
        const notes = [];

        // 模型大小建議
        if (summary.operators && summary.operators.total > 1000) {
            notes.push('大型模型，建議使用 GPU 加速');
        }

        // Runtime 建議
        if (summary.runtimeHints && summary.runtimeHints.length > 0) {
            notes.push(`建議 runtime: ${summary.runtimeHints.slice(0, 3).join(', ')}`);
        }

        if (!summary.quantization?.isQuantized) {
            notes.push('考慮量化以減少模型大小和提升推理速度');
        }

        return notes;
    }

    _describeInput(input) {
        if (input.domain === 'image') {
            return `圖像輸入，尺寸 ${input.shape.slice(-2).join('x')}`;
        } else if (input.domain === 'text') {
            return `文字輸入，序列長度 ${input.shape[1]}`;
        }
        return `數值輸入，形狀 [${input.shape.join(', ')}]`;

    }

    _suggestPreprocessing(input) {
        const suggestions = [];

        if (input.domain === 'image') {
            suggestions.push('調整圖像大小至模型所需尺寸');
            suggestions.push('正規化像素值至 [0,1] 或 [-1,1]');
            if (input.shape.length === 4 && input.shape[1] === 3) {
                suggestions.push('確保 RGB 通道順序');
            }
        } else if (input.domain === 'text') {
            suggestions.push('文字 tokenization');
            suggestions.push('添加 padding 或截斷至固定長度');
        }

        return suggestions;
    }

    _suggestPostprocessing(output, taskGuess) {
        const suggestions = [];

        switch (taskGuess) {
            case 'classification':
                suggestions.push('使用 Softmax 取得機率分佈');
                suggestions.push('取 argmax 得到預測類別');
                break;
            case 'detection':
                if (output.semantics === 'bounding_boxes') {
                    suggestions.push('應用 NMS 過濾重複框');
                    suggestions.push('將座標轉換為圖片尺寸');
                } else if (output.semantics === 'confidence_scores') {
                    suggestions.push('過濾低信心度的預測');
                }
                break;
            case 'pose':
                suggestions.push('將關鍵點座標映射回原圖尺寸');
                suggestions.push('過濾可見度低的關鍵點');
                break;
            case 'segmentation':
                suggestions.push('使用 argmax 得到每像素的類別');
                suggestions.push('調整 mask 尺寸至原圖大小');
                break;
        }

        return suggestions;
    }

    _describeOutput(output, taskGuess) {
        switch (taskGuess) {
            case 'classification':
                return `分類機率分佈，${output.shape[output.shape.length - 1]} 個類別`;
            case 'detection':
                if (output.semantics === 'bounding_boxes') {
                    return '檢測框座標 [x1, y1, x2, y2]';
                } else if (output.semantics === 'confidence_scores') {
                    return '檢測信心度分數';
                }
                return '物體檢測結果';
            case 'segmentation':
                return `分割遮罩，每像素的類別機率`;
            default:
                return `輸出張量，形狀 [${output.shape.join(', ')}]`;
        }
    }

    _generateONNXCode(summary) {
        const input = summary.inputs?.[0];
        const inputShape = input?.shape || [1, 3, 224, 224];

        return {
            python: `import onnxruntime as ort
import numpy as np

# 載入模型
session = ort.InferenceSession("${summary.modelName || 'model'}.onnx")

# 準備輸入數據
input_data = np.random.random(${JSON.stringify(inputShape)}).astype(np.float32)

# 執行推理
outputs = session.run(None, {"${input?.name || 'input'}": input_data})
result = outputs[0]`,

            javascript: `// 使用 ONNX.js
import { InferenceSession, Tensor } from 'onnxruntime-web';

const session = await InferenceSession.create('${summary.modelName || 'model'}.onnx');

// 準備輸入
const inputTensor = new Tensor('float32', inputData, ${JSON.stringify(inputShape)});

// 執行推理
const feeds = { "${input?.name || 'input'}": inputTensor };
const results = await session.run(feeds);`
        };
    }

    _generateTFLiteCode(summary) {
        const input = summary.inputs?.[0];

        return {
            python: `import tensorflow as tf
import numpy as np

# 載入 TFLite 模型
interpreter = tf.lite.Interpreter(model_path="${summary.modelName || 'model'}.tflite")
interpreter.allocate_tensors()

# 獲取輸入輸出詳情
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# 準備輸入數據
input_data = np.random.random(input_details[0]['shape']).astype(np.float32)
interpreter.set_tensor(input_details[0]['index'], input_data)

# 執行推理
interpreter.invoke()
output_data = interpreter.get_tensor(output_details[0]['index'])`
        };
    }

    _generateCoreMLCode(summary) {
        return {
            swift: `import CoreML
import Vision

// 載入模型
guard let model = try? VNCoreMLModel(for: ${summary.modelName || 'Model'}().model) else {
    fatalError("無法載入模型")
}

// 建立請求
let request = VNCoreMLRequest(model: model) { request, error in
    guard let results = request.results as? [VNClassificationObservation] else {
        return
    }
    // 處理結果
}

// 執行推理
let handler = VNImageRequestHandler(cgImage: cgImage)
try? handler.perform([request])`
        };
    }

    _generateGenericCode(summary) {
        return {
            python: `# 通用模型載入範例
# 請根據具體框架調整

import numpy as np

# 1. 載入模型
# model = load_model("${summary.modelName || 'model'}")

# 2. 準備輸入數據
# input_data = preprocess_input(raw_data)

# 3. 執行推理
# outputs = model.predict(input_data)

# 4. 後處理
# results = postprocess_output(outputs)`
        };
    }

    _getFormatLimitations(format) {
        const limitations = {
            onnx: ['需要 ONNX Runtime', '某些操作符可能不支援'],
            tflite: ['僅支援 TensorFlow Lite 操作符', '模型大小有限制'],
            coreml: ['僅限 iOS/macOS 平台', '需要 iOS 11+ 或 macOS 10.13+'],
            pytorch: ['需要 PyTorch 環境', '模型可能包含動態圖'],
            tensorflow: ['需要 TensorFlow 環境', '版本相容性問題']
        };

        return limitations[format] || ['請參考相應框架文檔'];
    }
}