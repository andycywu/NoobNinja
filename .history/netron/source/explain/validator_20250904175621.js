/**
 * Validator - 驗證 LLM 輸出與實際模型資訊的一致性
 * 確保生成的解釋和程式碼符合模型實際規格
 */

export class Validator {
    constructor() {
        this.validationRules = {
            shape: this._validateShapes.bind(this),
            dtype: this._validateDataTypes.bind(this),
            format: this._validateFormat.bind(this),
            code: this._validateCode.bind(this),
            consistency: this._validateConsistency.bind(this)
        };
    }

    /**
     * 驗證 LLM 輸出是否與模型摘要一致
     * @param {string} llmOutput - LLM 生成的解釋
     * @param {Object} originalSummary - 原始模型摘要
     * @returns {Object} 驗證結果
     */
    validate(llmOutput, originalSummary) {
        const validationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            confidence: 1.0,
            provenanceIssues: [],  // 新增：來源問題
            consistencyChecks: {}  // 新增：一致性檢查結果
        };

        // 執行各種驗證規則
        for (const [ruleName, ruleFunc] of Object.entries(this.validationRules)) {
            try {
                const result = ruleFunc(llmOutput, originalSummary);

                if (!result.isValid) {
                    validationResult.isValid = false;
                    validationResult.errors.push(...result.errors);
                }

                validationResult.warnings.push(...result.warnings);
                validationResult.suggestions.push(...result.suggestions);
                validationResult.confidence = Math.min(validationResult.confidence, result.confidence);

                // 儲存一致性檢查結果
                validationResult.consistencyChecks[ruleName] = result;

            } catch (error) {
                validationResult.warnings.push(`驗證規則 ${ruleName} 執行失敗: ${error.message}`);
            }
        }

        // 新增：檢查 provenance 和 confidence 合理性
        this._validateProvenance(originalSummary, validationResult);

        return validationResult;
    }

    /**
     * 驗證輸入輸出形狀是否一致
     */
    _validateShapes(llmOutput, summary) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            confidence: 1.0
        };

        // 提取 LLM 輸出中的形狀資訊
        const shapePatterns = [
            /\[(\d+(?:,\s*\d+)*)\]/g,           // [1, 3, 224, 224]
            /(\d+)x(\d+)/g,                     // 224x224
            /shape.*?(\d+(?:,\s*\d+)*)/gi,      // shape (1, 3, 224, 224)
            /尺寸.*?(\d+(?:,\s*\d+)*)/g         // 尺寸 224x224
        ];

        const extractedShapes = [];
        for (const pattern of shapePatterns) {
            let match;
            while ((match = pattern.exec(llmOutput)) !== null) {
                extractedShapes.push(match[1] || match[0]);
            }
        }

        // 檢查是否與實際輸入輸出形狀一致
        const actualInputShapes = summary.inputs.map((input) => input.shape.join(','));
        const actualOutputShapes = summary.outputs.map((output) => output.shape.join(','));
        const allActualShapes = [...actualInputShapes, ...actualOutputShapes];

        for (const extractedShape of extractedShapes) {
            const normalizedShape = extractedShape.replace(/\s/g, '');
            const isMatched = allActualShapes.some((actualShape) =>
                actualShape.replace(/\s/g, '') === normalizedShape
            );

            if (!isMatched) {
                result.warnings.push(`檢測到不一致的形狀: ${extractedShape}`);
                result.confidence *= 0.9;
            }
        }

        return result;
    }

    /**
     * 驗證數據類型是否正確
     */
    _validateDataTypes(llmOutput, summary) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            confidence: 1.0
        };

        // 提取 LLM 輸出中的數據類型
        const dtypePatterns = [
            /float32|float64|int32|int64|uint8|int8|bool/gi,
            /浮點數|整數|布林/g
        ];

        const extractedDtypes = [];
        for (const pattern of dtypePatterns) {
            const matches = llmOutput.match(pattern) || [];
            extractedDtypes.push(...matches);
        }

        // 檢查是否與實際數據類型一致
        const actualDtypes = [
            ...summary.inputs.map((input) => input.dtype),
            ...summary.outputs.map((output) => output.dtype)
        ];

        // 簡單檢查是否包含正確的數據類型
        if (extractedDtypes.length > 0 && actualDtypes.length > 0) {
            const hasValidDtype = extractedDtypes.some((extracted) =>
                actualDtypes.some((actual) =>
                    actual.toLowerCase().includes(extracted.toLowerCase())
                )
            );

            if (!hasValidDtype) {
                result.warnings.push('檢測到可能不正確的數據類型');
                result.confidence *= 0.9;
            }
        }

        return result;
    }

    /**
     * 驗證模型格式是否正確
     */
    _validateFormat(llmOutput, summary) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            confidence: 1.0
        };

        const actualFormat = summary.format.toLowerCase();
        const formatMentioned = llmOutput.toLowerCase().includes(actualFormat);

        if (!formatMentioned) {
            result.warnings.push(`LLM 輸出中未提及正確的模型格式: ${summary.format}`);
            result.confidence *= 0.95;
        }

        // 檢查是否提及了錯誤的格式
        const allFormats = ['onnx', 'tflite', 'coreml', 'tensorrt', 'openvino', 'pytorch', 'tensorflow'];
        const mentionedFormats = allFormats.filter((format) =>
            format !== actualFormat && llmOutput.toLowerCase().includes(format)
        );

        if (mentionedFormats.length > 0) {
            result.errors.push(`提及了錯誤的模型格式: ${mentionedFormats.join(', ')}`);
            result.isValid = false;
            result.confidence *= 0.7;
        }

        return result;
    }

    /**
     * 驗證程式碼範例是否正確
     */
    _validateCode(llmOutput, summary) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            confidence: 1.0
        };

        // 提取程式碼區塊
        const codeBlocks = this._extractCodeBlocks(llmOutput);

        for (const codeBlock of codeBlocks) {
            const codeValidation = this._validateCodeBlock(codeBlock, summary);

            if (!codeValidation.isValid) {
                result.errors.push(...codeValidation.errors);
                result.isValid = false;
            }

            result.warnings.push(...codeValidation.warnings);
            result.confidence = Math.min(result.confidence, codeValidation.confidence);
        }

        return result;
    }

    /**
     * 驗證整體一致性
     */
    _validateConsistency(llmOutput, summary) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            confidence: 1.0
        };

        // 檢查任務類型一致性
        const mentionedTasks = this._extractMentionedTasks(llmOutput);
        if (mentionedTasks.length > 0 && !mentionedTasks.includes(summary.taskGuess)) {
            if (summary.taskGuess !== 'unknown') {
                result.warnings.push(`推斷的任務類型不一致: LLM=${mentionedTasks}, 實際=${summary.taskGuess}`);
                result.confidence *= 0.85;
            }
        }

        // 檢查量化資訊一致性
        const mentionsQuantization = /量化|quantiz/i.test(llmOutput);
        if (mentionsQuantization !== summary.quantization.isQuantized) {
            result.warnings.push(`量化資訊不一致`);
            result.confidence *= 0.9;
        }

        return result;
    }

    /**
     * 提取程式碼區塊
     */
    _extractCodeBlocks(text) {
        const codeBlockRegex = /```[\s\S]*?```/g;
        const matches = text.match(codeBlockRegex) || [];
        return matches.map((match) => match.replace(/```/g, '').trim());
    }

    /**
     * 驗證單個程式碼區塊
     */
    _validateCodeBlock(code, summary) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            confidence: 1.0
        };

        // 檢查是否使用了正確的輸入名稱
        if (summary.inputs.length > 0) {
            const inputName = summary.inputs[0].name;
            if (inputName && !code.includes(inputName)) {
                result.warnings.push(`程式碼中未使用正確的輸入名稱: ${inputName}`);
                result.confidence *= 0.9;
            }
        }

        // 檢查是否使用了適當的推理框架
        const format = summary.format.toLowerCase();
        const expectedLibraries = {
            'onnx': ['onnxruntime', 'ort'],
            'tflite': ['tensorflow', 'tflite'],
            'coreml': ['coreml'],
            'tensorrt': ['tensorrt'],
            'openvino': ['openvino']
        };

        const expectedLibs = expectedLibraries[format] || [];
        const hasCorrectLibrary = expectedLibs.some((lib) => code.toLowerCase().includes(lib));

        if (!hasCorrectLibrary && expectedLibs.length > 0) {
            result.warnings.push(`程式碼未使用適當的推理框架，建議使用: ${expectedLibs.join(' 或 ')}`);
            result.confidence *= 0.8;
        }

        return result;
    }

    /**
     * 提取提及的任務類型
     */
    _extractMentionedTasks(text) {
        const taskKeywords = {
            'classification': ['分類', '識別', 'classification', 'classify'],
            'detection': ['偵測', '檢測', '物件', 'detection', 'detect', 'object'],
            'pose': ['姿態', '關鍵點', 'pose', 'keypoint', 'landmark'],
            'segmentation': ['分割', 'segmentation', 'segment']
        };

        const mentionedTasks = [];
        for (const [task, keywords] of Object.entries(taskKeywords)) {
            const isMentioned = keywords.some((keyword) =>
                text.toLowerCase().includes(keyword.toLowerCase())
            );
            if (isMentioned) {
                mentionedTasks.push(task);
            }
        }

        return mentionedTasks;
    }

    /**
     * 生成修正建議
     * @param {Object} validationResult - 驗證結果
     * @param {Object} summary - 模型摘要
     * @returns {Array} 修正建議列表
     */
    generateCorrections(validationResult, summary) {
        const corrections = [];

        if (!validationResult.isValid) {
            corrections.push('建議回退到基於規則的解釋，因為 LLM 輸出包含錯誤');
        }

        if (validationResult.confidence < 0.8) {
            corrections.push('建議人工檢查 LLM 輸出的準確性');
        }

        // 基於具體錯誤生成建議
        for (const error of validationResult.errors) {
            if (error.includes('格式')) {
                corrections.push(`請確認模型格式為 ${summary.format}`);
            }
            if (error.includes('形狀')) {
                corrections.push('請檢查輸入輸出形狀是否正確');
            }
        }

        return corrections;
    }

    /**
     * 計算整體信心度分數
     * @param {Object} validationResult - 驗證結果
     * @returns {number} 信心度分數 (0-1)
     */
    calculateConfidenceScore(validationResult) {
        let score = validationResult.confidence;

        // 根據錯誤數量調整分數
        score -= validationResult.errors.length * 0.2;
        score -= validationResult.warnings.length * 0.05;

        return Math.max(0, Math.min(1, score));
    }

    /**
     * 驗證 provenance 和 confidence 的合理性
     * @param {Object} summary - 模型摘要
     * @param {Object} validationResult - 驗證結果對象
     */
    _validateProvenance(summary, validationResult) {
        // 檢查輸入的 provenance 和 confidence
        if (summary.inputs) {
            for (const input of summary.inputs) {
                this._checkFieldProvenance(
                    'input',
                    input.name,
                    input.provenance,
                    input.confidence,
                    validationResult
                );
            }
        }

        // 檢查輸出的 provenance 和 confidence
        if (summary.outputs) {
            for (const output of summary.outputs) {
                this._checkFieldProvenance(
                    'output',
                    output.name,
                    output.provenance,
                    output.confidence,
                    validationResult
                );
            }
        }

        // 檢查任務推斷
        if (summary.taskGuess && typeof summary.taskGuess === 'object') {
            this._checkFieldProvenance(
                'task',
                'taskGuess',
                summary.taskGuess.provenance,
                summary.taskGuess.confidence,
                validationResult
            );
        }

        // 檢查量化資訊
        if (summary.quantization && summary.quantization.provenance) {
            this._checkFieldProvenance(
                'quantization',
                'quantization',
                summary.quantization.provenance,
                summary.quantization.confidence,
                validationResult
            );
        }
    }

    /**
     * 檢查單一欄位的 provenance
     */
    _checkFieldProvenance(fieldType, fieldName, provenance, confidence, validationResult) {
        // 檢查 provenance 值是否有效
        const validProvenances = ['model', 'inferred', 'heuristic', 'graph_scan'];
        if (!validProvenances.includes(provenance)) {
            validationResult.provenanceIssues.push({
                field: `${fieldType}.${fieldName}`,
                issue: 'invalid_provenance',
                message: `無效的 provenance 值: ${provenance}`
            });
        }

        // 檢查 confidence 值是否在合理範圍
        if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
            validationResult.provenanceIssues.push({
                field: `${fieldType}.${fieldName}`,
                issue: 'invalid_confidence',
                message: `confidence 值應該在 0-1 之間: ${confidence}`
            });
        }

        // 檢查 provenance 和 confidence 的一致性
        if (provenance === 'model' && confidence !== 1.0) {
            validationResult.warnings.push(
                `${fieldType}.${fieldName}: 來自模型的資料 confidence 應為 1.0，實際為 ${confidence}`
            );
        }

        if (provenance === 'inferred' && confidence > 0.9) {
            validationResult.warnings.push(
                `${fieldType}.${fieldName}: 推斷資料的 confidence 過高 (${confidence})，可能不準確`
            );
        }

        if (provenance === 'heuristic' && confidence > 0.8) {
            validationResult.warnings.push(
                `${fieldType}.${fieldName}: 啟發式推斷的 confidence 過高 (${confidence})`
            );
        }
    }

    /**
     * 建議改用規則版本的條件檢查
     * @param {Object} validationResult - 驗證結果
     * @returns {boolean} 是否建議回退到規則版本
     */
    shouldFallbackToRules(validationResult) {
        // 如果有嚴重錯誤，建議回退
        if (validationResult.errors.length > 0) {
            return true;
        }

        // 如果信心度過低，建議回退
        if (validationResult.confidence < 0.6) {
            return true;
        }

        // 如果有太多 provenance 問題，建議回退
        if (validationResult.provenanceIssues && validationResult.provenanceIssues.length > 3) {
            return true;
        }

        return false;
    }

    /**
     * 生成回退建議訊息
     * @param {Object} validationResult - 驗證結果
     * @returns {string} 回退建議訊息
     */
    getFallbackMessage(validationResult) {
        const reasons = [];

        if (validationResult.errors.length > 0) {
            reasons.push(`發現 ${validationResult.errors.length} 個錯誤`);
        }

        if (validationResult.confidence < 0.6) {
            reasons.push(`信心度過低 (${Math.round(validationResult.confidence * 100)}%)`);
        }

        if (validationResult.provenanceIssues && validationResult.provenanceIssues.length > 3) {
            reasons.push(`資料來源問題過多`);
        }

        return `建議回退到規則版本: ${reasons.join(', ')}`;
    }
}
