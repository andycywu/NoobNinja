/**
 * Exporter - 匯出模型卡片和程式碼範例
 * 支援匯出 Markdown 格式的模型卡片和可執行的程式碼範例
 */

export class Exporter {
    constructor() {
        this.defaultTemplates = {
            readme: this._getReadmeTemplate(),
            quickstart: this._getQuickstartTemplate(),
            requirements: this._getRequirementsTemplate()
        };
    }

    /**
     * 匯出完整的模型包
     * @param {Object} summary - 模型摘要
     * @param {Object} explanation - 模型解釋
     * @param {Object} options - 匯出選項
     * @returns {Promise<Blob>} ZIP 檔案
     */
    async exportModelPackage(summary, explanation, options = {}) {
        const files = await this._generateFiles(summary, explanation, options);
        return this._createZipFile(files);
    }

    /**
     * 匯出 Model Card (README.md)
     * @param {Object} summary - 模型摘要
     * @param {Object} explanation - 模型解釋
     * @param {Object} options - 匯出選項
     * @returns {string} Markdown 內容
     */
    exportModelCard(summary, explanation, options = {}) {
        const template = this.defaultTemplates.readme;

        return template
            .replace('{modelName}', summary.modelName)
            .replace('{format}', summary.format)
            .replace('{taskGuess}', this._translateTask(summary.taskGuess))
            .replace('{purpose}', explanation.purpose || '待補充')
            .replace('{inputRequirements}', this._formatInputRequirements(explanation.inputRequirements))
            .replace('{outputMeaning}', this._formatOutputMeaning(explanation.outputMeaning))
            .replace('{applications}', this._formatApplications(explanation.applications))
            .replace('{limitations}', this._formatLimitations(explanation.limitations))
            .replace('{performance}', this._formatPerformance(explanation.performance))
            .replace('{metadata}', this._formatMetadata(summary.metadata))
            .replace('{date}', new Date().toISOString().split('T')[0]);
    }

    /**
     * 匯出 Quickstart 程式碼
     * @param {Object} summary - 模型摘要
     * @param {Object} explanation - 模型解釋
     * @param {string} language - 程式語言
     * @returns {string} 程式碼內容
     */
    exportQuickstartCode(summary, explanation, language = 'python') {
        const codeTemplate = explanation.quickstartCode?.[language];
        if (codeTemplate) {
            return codeTemplate;
        }

        // 如果沒有 LLM 生成的程式碼，使用預設模板
        return this._generateDefaultCode(summary, language);
    }

    /**
     * 匯出 requirements.txt
     * @param {Object} summary - 模型摘要
     * @returns {string} 依賴清單
     */
    exportRequirements(summary) {
        const format = summary.format.toLowerCase();
        const baseRequirements = this._getBaseRequirements(format);

        let requirements = baseRequirements.join('\n');

        // 添加註解
        requirements += '\n\n# 模型推理依賴\n';
        requirements += `# 格式: ${summary.format}\n`;
        requirements += `# 任務: ${summary.taskGuess}\n`;

        if (summary.quantization.isQuantized) {
            requirements += '# 量化模型，可能需要特殊版本的推理引擎\n';
        }

        return requirements;
    }

    /**
     * 生成所有檔案
     */
    async _generateFiles(summary, explanation, options) {
        const files = [];

        // README.md
        files.push({
            name: 'README.md',
            content: this.exportModelCard(summary, explanation, options)
        });

        // quickstart.py
        files.push({
            name: 'quickstart.py',
            content: this.exportQuickstartCode(summary, explanation, 'python')
        });

        // requirements.txt
        files.push({
            name: 'requirements.txt',
            content: this.exportRequirements(summary)
        });

        // 如果有 JavaScript 程式碼，也匯出
        if (explanation.quickstartCode?.javascript) {
            files.push({
                name: 'quickstart.js',
                content: explanation.quickstartCode.javascript
            });

            files.push({
                name: 'package.json',
                content: this._generatePackageJson(summary)
            });
        }

        // 模型摘要 JSON
        files.push({
            name: 'model_summary.json',
            content: JSON.stringify(summary, null, 2)
        });

        return files;
    }

    /**
     * 建立 ZIP 檔案
     */
    async _createZipFile(files) {
        // 使用瀏覽器原生 API 或載入 JSZip
        if (typeof window !== 'undefined' && window.JSZip) {
            return this._createZipWithJSZip(files);
        }

        // 簡化版：返回檔案陣列（可以在 UI 中處理）
        return files;
    }

    /**
     * 使用 JSZip 建立 ZIP
     */
    async _createZipWithJSZip(files) {
        const zip = new window.JSZip();

        for (const file of files) {
            zip.file(file.name, file.content);
        }

        return await zip.generateAsync({ type: 'blob' });
    }

    /**
     * 格式化輸入需求
     */
    _formatInputRequirements(requirements) {
        if (!requirements || requirements.length === 0) {
            return '待補充';
        }

        return requirements.map((req) => {
            let formatted = `### ${req.name}\n`;
            formatted += `- **形狀**: \`${JSON.stringify(req.shape)}\`\n`;
            formatted += `- **類型**: \`${req.dtype}\`\n`;
            formatted += `- **領域**: ${req.domain}\n`;
            formatted += `- **描述**: ${req.description}\n`;

            if (req.preprocessing && req.preprocessing.length > 0) {
                formatted += `- **前處理**:\n`;
                for (const step of req.preprocessing) {
                    formatted += `  - ${step}\n`;
                }
            }

            return formatted;
        }).join('\n');
    }

    /**
     * 格式化輸出含義
     */
    _formatOutputMeaning(meanings) {
        if (!meanings || meanings.length === 0) {
            return '待補充';
        }

        return meanings.map((meaning) => {
            let formatted = `### ${meaning.name}\n`;
            formatted += `- **形狀**: \`${JSON.stringify(meaning.shape)}\`\n`;
            formatted += `- **類型**: \`${meaning.dtype}\`\n`;
            formatted += `- **語義**: ${meaning.semantics}\n`;
            formatted += `- **描述**: ${meaning.description}\n`;

            if (meaning.postprocessing && meaning.postprocessing.length > 0) {
                formatted += `- **後處理**:\n`;
                for (const step of meaning.postprocessing) {
                    formatted += `  - ${step}\n`;
                }
            }

            return formatted;
        }).join('\n');
    }

    /**
     * 格式化應用場景
     */
    _formatApplications(applications) {
        if (!applications || applications.length === 0) {
            return '待補充';
        }

        return applications.map((app) => `- ${app}`).join('\n');
    }

    /**
     * 格式化限制說明
     */
    _formatLimitations(limitations) {
        if (!limitations || limitations.length === 0) {
            return '待補充';
        }

        return limitations.map((limitation) => `- ${limitation}`).join('\n');
    }

    /**
     * 格式化性能說明
     */
    _formatPerformance(performance) {
        if (!performance || performance.length === 0) {
            return '待補充';
        }

        return performance.map((note) => `- ${note}`).join('\n');
    }

    /**
     * 格式化元數據
     */
    _formatMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) {
            return '無額外元數據';
        }

        return Object.entries(metadata)
            .filter(([, value]) => value)
            .map(([key, value]) => `- **${key}**: ${value}`)
            .join('\n');
    }

    /**
     * 翻譯任務類型
     */
    _translateTask(task) {
        const translations = {
            'classification': '圖像分類',
            'detection': '物件偵測',
            'pose': '姿態估計',
            'segmentation': '影像分割',
            'unknown': '未知任務'
        };
        return translations[task] || task;
    }

    /**
     * 獲取基礎依賴
     */
    _getBaseRequirements(format) {
        const requirements = {
            'onnx': ['onnxruntime>=1.15.0', 'numpy>=1.21.0'],
            'tflite': ['tensorflow>=2.12.0', 'numpy>=1.21.0'],
            'coreml': ['coremltools>=7.0', 'numpy>=1.21.0'],
            'tensorrt': ['tensorrt>=8.0.0', 'numpy>=1.21.0', 'pycuda>=2022.1'],
            'openvino': ['openvino>=2023.0.0', 'numpy>=1.21.0']
        };

        return requirements[format] || ['numpy>=1.21.0'];
    }

    /**
     * 生成預設程式碼
     */
    _generateDefaultCode(summary, language) {
        if (language === 'python') {
            return this._generateDefaultPythonCode(summary);
        }
        if (language === 'javascript') {
            return this._generateDefaultJavaScriptCode(summary);
        }
        return '# 暫不支援此程式語言';
    }

    /**
     * 生成預設 Python 程式碼
     */
    _generateDefaultPythonCode(summary) {
        const format = summary.format.toLowerCase();
        const input = summary.inputs[0];
        const inputShape = input ? JSON.stringify(input.shape) : '[1, 3, 224, 224]';
        const inputName = input ? input.name : 'input';

        if (format === 'onnx') {
            return `#!/usr/bin/env python3
"""
${summary.modelName} - ONNX 推理範例
自動生成於 ${new Date().toISOString().split('T')[0]}
"""

import onnxruntime as ort
import numpy as np

def load_model(model_path):
    """載入 ONNX 模型"""
    session = ort.InferenceSession(model_path)
    return session

def preprocess_input(data):
    """前處理輸入數據"""
    # TODO: 根據實際需求調整前處理步驟
    return data.astype(np.float32)

def run_inference(session, input_data):
    """執行推理"""
    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: input_data})
    return outputs

def main():
    # 載入模型
    model_path = "model.onnx"
    session = load_model(model_path)
    
    # 準備測試數據
    input_shape = ${inputShape}
    test_input = np.random.random(input_shape).astype(np.float32)
    
    # 前處理
    processed_input = preprocess_input(test_input)
    
    # 執行推理
    outputs = run_inference(session, processed_input)
    
    # 顯示結果
    for i, output in enumerate(outputs):
        print(f"Output {i}: shape={output.shape}, dtype={output.dtype}")
        print(f"Sample values: {output.flat[:5]}")

if __name__ == "__main__":
    main()`;
        }

        return `# ${summary.modelName} 推理範例
# 格式: ${summary.format}
# 請根據具體格式選擇適當的推理框架`;
    }

    /**
     * README 模板
     */
    _getReadmeTemplate() {
        return `# {modelName}

> 自動生成的模型卡片 - {date}

## 模型資訊

- **格式**: {format}
- **任務**: {taskGuess}

## 模型用途

{purpose}

## 輸入需求

{inputRequirements}

## 輸出含義

{outputMeaning}

## 應用場景

{applications}

## 快速開始

\`\`\`bash
# 安裝依賴
pip install -r requirements.txt

# 執行範例
python quickstart.py
\`\`\`

## 性能建議

{performance}

## 限制說明

{limitations}

## 技術細節

{metadata}

## 授權聲明

請遵守原模型的授權條款。

---

*此文檔由 Netron Explain 工具自動生成*`;
    }

    /**
     * 生成 package.json
     */
    _generatePackageJson(summary) {
        return JSON.stringify({
            name: `${summary.modelName.toLowerCase().replace(/\s+/g, '-')}-inference`,
            version: '1.0.0',
            description: `${summary.modelName} 推理範例`,
            main: 'quickstart.js',
            dependencies: {
                'onnxruntime-web': '^1.18.0'
            },
            scripts: {
                start: 'node quickstart.js'
            }
        }, null, 2);
    }

    /**
     * 生成預設 JavaScript 程式碼
     */
    _generateDefaultJavaScriptCode(summary) {
        const input = summary.inputs[0];
        const inputShape = input ? JSON.stringify(input.shape) : '[1, 3, 224, 224]';

        return `// ${summary.modelName} - JavaScript 推理範例
const ort = require('onnxruntime-web');

async function loadModel(modelPath) {
    const session = await ort.InferenceSession.create(modelPath);
    return session;
}

async function runInference(session, inputData) {
    const inputName = session.inputNames[0];
    const tensor = new ort.Tensor('float32', inputData, ${inputShape});
    const results = await session.run({[inputName]: tensor});
    return results;
}

async function main() {
    try {
        // 載入模型
        const session = await loadModel('model.onnx');
        
        // 準備測試數據
        const inputSize = ${input ? input.shape.reduce((a, b) => a * b, 1) : 150528};
        const inputData = new Float32Array(inputSize);
        for (let i = 0; i < inputSize; i++) {
            inputData[i] = Math.random();
        }
        
        // 執行推理
        const results = await runInference(session, inputData);
        
        // 顯示結果
        console.log('推理完成:');
        for (const [name, tensor] of Object.entries(results)) {
            console.log(\`Output \${name}: shape=[\${tensor.dims.join(', ')}]\`);
        }
        
    } catch (error) {
        console.error('推理失敗:', error);
    }
}

main();`;
    }
}
