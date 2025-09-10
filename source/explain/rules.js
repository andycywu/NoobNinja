/**
 * Rules Engine - 基於規則產生白話說明（不依賴 LLM）
 * 根據模型摘要生成用戶友好的解釋
 */

/* eslint-disable no-unused-vars */
export class RulesEngine {
    constructor() {
        this.taskTemplates = {
            classification: this._getClassificationTemplate(),
            detection: this._getDetectionTemplate(),
            pose: this._getPoseTemplate(),
            segmentation: this._getSegmentationTemplate(),
            unknown: this._getUnknownTemplate()
        };
    }

    /**
     * 根據模型摘要產生白話卡片
     * @param {Object} summary - ModelSummarizer 的輸出
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

        // 替換變數
        purpose = purpose.replace('{format}', summary.format.toUpperCase());
        purpose = purpose.replace('{precision}', summary.quantization.precision);
        purpose = purpose.replace('{modelName}', summary.modelName);

        return purpose;
    }

    _generateInputRequirements(summary) {
        const requirements = [];

        for (const input of summary.inputs) {
            const req = {
                name: input.name,
                shape: input.shape,
                dtype: input.dtype,
                domain: input.domain,
                preprocessing: this._suggestPreprocessing(input),
                description: this._describeInput(input)
            };
            requirements.push(req);
        }

        return requirements;
    }

    _generateOutputMeaning(summary) {
        const meanings = [];

        for (const output of summary.outputs) {
            const meaning = {
                name: output.name,
                shape: output.shape,
                dtype: output.dtype,
                semantics: output.semantics,
                description: this._describeOutput(output, summary.taskGuess),
                postprocessing: this._suggestPostprocessing(output, summary.taskGuess)
            };
            meanings.push(meaning);
        }

        return meanings;
    }

    _generateApplications(summary, template) {
        return template.applications;
    }

    _generateQuickstartCode(summary) {
        const format = summary.format.toLowerCase();

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
        const formatLimitations = this._getFormatLimitations(summary.format);
        limitations.push(...formatLimitations);

        // 基於量化的限制
        if (summary.quantization.isQuantized) {
            limitations.push('量化模型可能會有精度損失');
            limitations.push('需要支援量化推理的 runtime');
        }

        // 基於輸入的限制
        for (const input of summary.inputs) {
            if (input.shape.includes('?') || input.shape.includes(-1)) {
                limitations.push('模型包含動態維度，需要在推理時指定具體尺寸');
            }
        }

        return limitations;
    }

    _generatePerformanceNotes(summary) {
        const notes = [];

        // 複雜度相關
        if (summary.operators && summary.operators.total > 1000) {
            notes.push('模型較為複雜，推理可能需要較多時間');
        }

        // Runtime 建議
        if (summary.runtimeHints && summary.runtimeHints.length > 0) {
            notes.push(`建議 runtime: ${summary.runtimeHints.slice(0, 3).join(', ')}`);
        }
        // 量化建議
        if (!summary.quantization.isQuantized) {
            notes.push('可考慮量化以提升推理速度');
        }

        return notes;
    }

    _suggestPreprocessing(input) {
        const suggestions = [];

        if (input.domain === 'image') {
            const shape = input.shape;
            if (shape.length === 4) {
                const height = shape[2] || shape[1];
                const width = shape[3] || shape[2];

                suggestions.push(`調整圖片尺寸至 ${height}x${width}`);

                if (input.dtype.includes('float')) {
                    suggestions.push('正規化像素值到 [0, 1] 或 [-1, 1]');
                } else {
                    suggestions.push('保持像素值在 [0, 255]');
                }

                // 判斷 channel 順序
                if (shape[1] === 3) {
                    suggestions.push('使用 CHW 格式 (Channel-Height-Width)');
                } else if (shape[3] === 3) {
                    suggestions.push('使用 HWC 格式 (Height-Width-Channel)');
                }
            }
        } else if (input.domain === 'text') {
            suggestions.push('將文字轉換為 token IDs');
            suggestions.push('添加 padding 至固定長度');
        } else if (input.domain === 'tabular') {
            suggestions.push('正規化數值特徵');
            suggestions.push('編碼類別特徵');
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

    _describeInput(input) {
        const domain = input.domain;
        const shape = input.shape;

        if (domain === 'image') {
            if (shape.length === 4) {
                const batch = shape[0];
                const channels = shape[1] === 3 ? 3 : shape[3];
                const height = shape[2] || shape[1];
                const width = shape[3] || shape[2];

                return `${batch === 1 ? '單張' : '批次'} ${height}x${width} ${channels === 3 ? 'RGB' : '灰階'}圖片`;
            }
        } else if (domain === 'tabular') {
            return `${shape[1]} 個特徵的表格數據`;
        } else if (domain === 'sequence') {
            return `序列長度 ${shape[1]} 的文字或時序數據`;
        }

        return `形狀為 [${shape.join(', ')}] 的 ${input.dtype} 張量`;
    }

    _describeOutput(output, taskGuess) {
        const semantics = output.semantics;
        const shape = output.shape;

        if (semantics === 'logits' || semantics === 'classification') {
            return `${shape[shape.length - 1]} 個類別的預測分數`;
        } else if (semantics === 'bounding_boxes') {
            return `物件邊界框座標 (x1, y1, x2, y2 或 x, y, w, h)`;
        } else if (semantics === 'keypoints') {
            return `關鍵點座標 (x, y) 或 (x, y, visibility)`;
        } else if (semantics === 'segmentation_mask') {
            return `像素級分割遮罩`;
        } else if (semantics === 'confidence_scores') {
            return `置信度分數`;
        }

        return `形狀為 [${shape.join(', ')}] 的 ${output.dtype} 張量`;
    }

    _generateONNXCode(summary) {
        const input = summary.inputs[0];
        const inputShape = input ? input.shape : [1, 3, 224, 224];

        return {
            python: `# ONNX 模型推理範例
import onnxruntime as ort
import numpy as np

# 載入模型
session = ort.InferenceSession("model.onnx")

# 準備輸入數據
input_data = np.random.random(${JSON.stringify(inputShape)}).astype(np.float32)

# 執行推理
outputs = session.run(None, {"${input?.name || 'input'}": input_data})

# 查看輸出
for i, output in enumerate(outputs):
    print(f"Output {i}: {output.shape}")`,

            javascript: `// ONNX 瀏覽器推理範例
const ort = require('onnxruntime-web');

async function runInference() {
    // 載入模型
    const session = await ort.InferenceSession.create('model.onnx');
    
    // 準備輸入數據
    const inputData = new Float32Array(${inputShape.reduce((a, b) => a * b, 1)});
    const tensor = new ort.Tensor('float32', inputData, ${JSON.stringify(inputShape)});
    
    // 執行推理
    const results = await session.run({"${input?.name || 'input'}": tensor});
    
    console.log('推理結果:', results);
}`
        };
    }

    _generateTFLiteCode(summary) {
        return {
            python: `# TensorFlow Lite 推理範例
import tensorflow as tf
import numpy as np

# 載入模型
interpreter = tf.lite.Interpreter(model_path="model.tflite")
interpreter.allocate_tensors()

# 取得輸入輸出詳情
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# 準備輸入數據
input_shape = input_details[0]['shape']
input_data = np.random.random(input_shape).astype(np.float32)

# 執行推理
interpreter.set_tensor(input_details[0]['index'], input_data)
interpreter.invoke()

# 取得輸出
output_data = interpreter.get_tensor(output_details[0]['index'])
print(f"輸出形狀: {output_data.shape}")`
        };
    }

    _generateCoreMLCode(summary) {
        return {
            swift: `// Core ML 推理範例
import CoreML
import Vision

guard let model = try? MLModel(contentsOf: modelURL) else {
    print("無法載入模型")
    return
}

// 使用 Vision 框架處理圖片
let request = VNCoreMLRequest(model: VNCoreMLModel(for: model)!) { request, error in
    guard let results = request.results as? [VNClassificationObservation] else {
        return
    }
    
    for result in results {
        print("\\(result.identifier): \\(result.confidence)")
    }
}

let handler = VNImageRequestHandler(cgImage: inputImage)
try? handler.perform([request])`
        };
    }

    _generateGenericCode(summary) {
        return {
            python: `# 通用模型推理範例
# 請根據您的模型格式選擇適當的推理框架
# ONNX: onnxruntime
# TensorFlow: tensorflow
# PyTorch: torch

import numpy as np

# 1. 載入模型
# model = load_model("path/to/model")

# 2. 準備輸入數據
input_shape = ${JSON.stringify(summary.inputs[0]?.shape || [1, 3, 224, 224])}
input_data = np.random.random(input_shape).astype(np.float32)

# 3. 執行推理
# outputs = model.predict(input_data)

# 4. 處理輸出
# print("預測結果:", outputs)`
        };
    }

    _getFormatLimitations(format) {
        const limitations = {
            'onnx': [
                '需要 ONNX Runtime 或相容的推理引擎',
                '某些算子可能不被所有 runtime 支援'
            ],
            'tflite': [
                '主要針對移動設備優化',
                '支援的算子相對有限'
            ],
            'coreml': [
                '僅限 Apple 平台 (iOS, macOS)',
                '需要 iOS 11+ 或 macOS 10.13+'
            ],
            'tensorrt': [
                '僅限 NVIDIA GPU',
                '需要 CUDA 和 TensorRT 環境'
            ],
            'openvino': [
                '主要支援 Intel 硬體',
                '需要 OpenVINO toolkit'
            ]
        };

        return limitations[format.toLowerCase()] || ['請確認支援的推理框架'];
    }

    // 任務模板定義
    _getClassificationTemplate() {
        return {
            purpose: '這是一個 {format} 格式的圖像分類模型，使用 {precision} 精度。它能夠識別輸入圖片中的主要物件類別。',
            applications: [
                '圖片內容識別',
                '物件分類',
                '品質檢測',
                '醫學影像診斷',
                '內容審核'
            ]
        };
    }

    _getDetectionTemplate() {
        return {
            purpose: '這是一個 {format} 格式的物件偵測模型，使用 {precision} 精度。它能夠在圖片中定位並識別多個物件。',
            applications: [
                '自動駕駛',
                '監控系統',
                '零售分析',
                '機器人視覺',
                '增強現實'
            ]
        };
    }

    _getPoseTemplate() {
        return {
            purpose: '這是一個 {format} 格式的姿態估計模型，使用 {precision} 精度。它能夠檢測人體關鍵點位置。',
            applications: [
                '運動分析',
                '健身指導',
                '動作捕捉',
                '遊戲控制',
                '醫療復健'
            ]
        };
    }

    _getSegmentationTemplate() {
        return {
            purpose: '這是一個 {format} 格式的影像分割模型，使用 {precision} 精度。它能夠對圖片進行像素級的分類。',
            applications: [
                '醫學影像分析',
                '自動駕駛道路理解',
                '影像編輯',
                '場景理解',
                '機器人導航'
            ]
        };
    }

    _getUnknownTemplate() {
        return {
            purpose: '這是一個 {format} 格式的深度學習模型，使用 {precision} 精度。模型的具體用途需要進一步分析。',
            applications: [
                '請參考模型文檔',
                '根據輸入輸出特徵推斷用途',
                '諮詢模型作者'
            ]
        };
    }
}
