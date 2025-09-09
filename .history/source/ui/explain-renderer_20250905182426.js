/**
 * UI 渲染器 - 處理徽章顯示和模型小白解碼器的 UI 渲染
 */

export class ExplainUIRenderer {
    constructor() {
        this.provenanceLabels = {
            'model': { text: '來自模型', color: 'green' },
            'inferred': { text: '推斷', color: 'yellow' },
            'heuristic': { text: '推斷', color: 'yellow' },
            'graph_scan': { text: '圖掃描', color: 'blue' }
        };
    }

    /**
     * 渲染欄位值帶徽章
     */
    renderFieldWithBadge(fieldValue, provenance, confidence, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'field-with-badge';

        // 主內容
        const content = document.createElement('div');
        content.className = 'field-content';

        if (typeof fieldValue === 'string') {
            content.textContent = fieldValue;
        } else if (Array.isArray(fieldValue)) {
            content.textContent = fieldValue.join(', ');
        } else if (typeof fieldValue === 'object') {
            content.textContent = JSON.stringify(fieldValue, null, 2);
        } else {
            content.textContent = String(fieldValue);
        }

        // 徽章
        const badge = this.createProvenianceBadge(provenance, confidence);

        wrapper.appendChild(content);
        wrapper.appendChild(badge);

        if (container) {
            container.appendChild(wrapper);
        }

        return wrapper;
    }

    /**
     * 創建來源徽章
     */
    createProvenianceBadge(provenance, confidence) {
        const badge = document.createElement('span');
        const config = this.provenanceLabels[provenance] || this.provenanceLabels.inferred;

        badge.className = `provenance-badge provenance-${config.color}`;

        let text = config.text;
        if (provenance === 'inferred' || provenance === 'heuristic') {
            const percentage = Math.round((confidence || 0.5) * 100);
            text += ` ${percentage}%`;
        }

        badge.textContent = text;
        badge.title = this.getProvenanceTooltip(provenance, confidence);

        return badge;
    }

    /**
     * 取得來源提示文字
     */
    getProvenanceTooltip(provenance, confidence) {
        const percentage = Math.round((confidence || 0.5) * 100);

        switch (provenance) {
            case 'model':
                return '此資訊直接來自模型定義，準確度最高';
            case 'inferred':
                return `根據模型結構推斷而來，信心度：${percentage}%`;
            case 'heuristic':
                return `基於常見模式推斷，信心度：${percentage}%`;
            case 'graph_scan':
                return `透過圖結構掃描獲得，信心度：${percentage}%`;
            default:
                return '資料來源不明';
        }
    }

    /**
     * 渲染完整的 Explain 面板
     */
    renderExplainPanel(analysisResult, container) {
        container.innerHTML = '';
        container.className = 'explain-panel';
        // 標題與工具列
        const header = this.createPanelHeader(analysisResult);
        container.appendChild(header);

        // 內容區域：建立 tab 容器（預設顯示 LLM 回應）
        const tabContainer = document.createElement('div');
        tabContainer.className = 'explain-tabs';

        const tabsHeader = document.createElement('div');
        tabsHeader.className = 'explain-tabs-header';

        const llmTabBtn = document.createElement('button');
        llmTabBtn.className = 'explain-tab-btn active';
        llmTabBtn.textContent = 'LLM 回應';

        const rawTabBtn = document.createElement('button');
        rawTabBtn.className = 'explain-tab-btn';
        rawTabBtn.textContent = '原始摘要與欄位';

        tabsHeader.appendChild(llmTabBtn);
        tabsHeader.appendChild(rawTabBtn);
        tabContainer.appendChild(tabsHeader);

        const tabsContent = document.createElement('div');
        tabsContent.className = 'explain-tabs-content';

        // LLM 面板
        const llmPanel = document.createElement('div');
        llmPanel.className = 'explain-tab-panel llm-panel';
        // 顯示 LLM 解釋（如果有）
        if (analysisResult.explanation && Object.keys(analysisResult.explanation).length > 0) {
            // 顯示原始 prompt（可收合）
            if (analysisResult.explanation._llmPrompt) {
                const pSection = document.createElement('div');
                pSection.className = 'explain-section';
                const pTitle = document.createElement('h3');
                pTitle.textContent = 'LLM 使用的 Prompt (點擊展開)';
                pSection.appendChild(pTitle);
                const pContent = document.createElement('div');
                pContent.className = 'explain-section-content';
                const pPre = document.createElement('pre');
                pPre.className = 'llm-prompt-pre';
                pPre.textContent = analysisResult.explanation._llmPrompt;
                pContent.appendChild(pPre);
                pSection.appendChild(pContent);
                llmPanel.appendChild(pSection);
            }

            // 顯示 LLM 原始回應（可收合）
            if (analysisResult.explanation._llmRaw) {
                const rSection = document.createElement('div');
                rSection.className = 'explain-section';
                const rTitle = document.createElement('h3');
                rTitle.textContent = 'LLM 原始回應 (點擊展開)';
                rSection.appendChild(rTitle);
                const rContent = document.createElement('div');
                rContent.className = 'explain-section-content';
                const rPre = document.createElement('pre');
                rPre.className = 'llm-raw-pre';
                rPre.textContent = analysisResult.explanation._llmRaw;
                rContent.appendChild(rPre);
                rSection.appendChild(rContent);
                llmPanel.appendChild(rSection);
            }
            // 直接顯示原始 LLM 文本段落（如果有解析版則顯示解析版）
            const purpose = analysisResult.explanation.purpose ? this.createField('用途', analysisResult.explanation.purpose, 'inferred', 0.8) : null;
            if (purpose) {
                llmPanel.appendChild(purpose);
            }

            // 嘗試顯示解析後的輸入/輸出說明
            if (analysisResult.explanation.inputRequirements && analysisResult.explanation.inputRequirements.length > 0) {
                const inputsSection = document.createElement('div');
                inputsSection.className = 'explain-section';
                const title = document.createElement('h3');
                title.textContent = 'LLM 建議的輸入需求';
                inputsSection.appendChild(title);
                const content = document.createElement('div');
                content.className = 'explain-section-content';
                for (const ir of analysisResult.explanation.inputRequirements) {
                    const field = this.createField(ir.label || 'Input', ir.description || JSON.stringify(ir), 'inferred', 0.7);
                    content.appendChild(field);
                }
                inputsSection.appendChild(content);
                llmPanel.appendChild(inputsSection);
            }

            if (analysisResult.explanation.outputMeaning && analysisResult.explanation.outputMeaning.length > 0) {
                const outputsSection = document.createElement('div');
                outputsSection.className = 'explain-section';
                const title = document.createElement('h3');
                title.textContent = 'LLM 建議的輸出解讀';
                outputsSection.appendChild(title);
                const content = document.createElement('div');
                content.className = 'explain-section-content';
                for (const om of analysisResult.explanation.outputMeaning) {
                    const field = this.createField(om.label || 'Output', om.description || JSON.stringify(om), 'inferred', 0.7);
                    content.appendChild(field);
                }
                outputsSection.appendChild(content);
                llmPanel.appendChild(outputsSection);
            }

            // 若解析後內容不足，顯示原始 LLM 文本
            if ((!analysisResult.explanation.inputRequirements || analysisResult.explanation.inputRequirements.length === 0) && (!analysisResult.explanation.outputMeaning || analysisResult.explanation.outputMeaning.length === 0) && !analysisResult.explanation.purpose) {
                const pre = document.createElement('pre');
                pre.className = 'llm-raw-pre';
                // 嘗試從 ExplainEngine 的原始 LLM 回應（如果有）讀取
                try {
                    const raw = analysisResult._llmRaw || (analysisResult.explanation && analysisResult.explanation.rawText) || null;
                    pre.textContent = raw || 'LLM 未提供解析內容。';
                } catch (e) {
                    pre.textContent = 'LLM 未提供解析內容。';
                }
                llmPanel.appendChild(pre);
            }
        } else {
            const empty = document.createElement('div');
            empty.className = 'explain-section-content';
            empty.textContent = '尚無 LLM 回應可顯示。';
            llmPanel.appendChild(empty);
        }

        // 原始摘要面板（把原有內容放到這裡）
        const rawPanel = document.createElement('div');
        rawPanel.className = 'explain-tab-panel raw-panel';

        // 把原本的 sections 放入 rawPanel
        const overview = this.renderOverview(analysisResult.summary);
        rawPanel.appendChild(overview);
        const inputs = this.renderInputs(analysisResult.summary.inputs);
        rawPanel.appendChild(inputs);
        const outputs = this.renderOutputs(analysisResult.summary.outputs);
        rawPanel.appendChild(outputs);
        const task = this.renderTaskType(analysisResult.summary.taskGuess);
        rawPanel.appendChild(task);
        const quantization = this.renderQuantization(analysisResult.summary.quantization);
        rawPanel.appendChild(quantization);
        if (analysisResult.explanation) {
            const usage = this.renderUsageGuide(analysisResult.explanation);
            rawPanel.appendChild(usage);
        }

        // Raw summary collapse section
        const rawSummarySection = this.renderRawSummary(analysisResult);
        rawPanel.appendChild(rawSummarySection);

        tabsContent.appendChild(llmPanel);
        tabsContent.appendChild(rawPanel);
        tabContainer.appendChild(tabsContent);

        // 切換邏輯
        llmTabBtn.addEventListener('click', () => {
            llmTabBtn.classList.add('active');
            rawTabBtn.classList.remove('active');
            llmPanel.style.display = 'block';
            rawPanel.style.display = 'none';
        });
        rawTabBtn.addEventListener('click', () => {
            rawTabBtn.classList.add('active');
            llmTabBtn.classList.remove('active');
            rawPanel.style.display = 'block';
            llmPanel.style.display = 'none';
        });

        // 預設顯示 LLM 面板，隱藏 rawPanel
        llmPanel.style.display = 'block';
        rawPanel.style.display = 'none';

        container.appendChild(tabContainer);

        // 加入樣式
        this.addStyles();
    }

    /**
     * 創建面板標題
     */
    createPanelHeader(analysisResult) {
        const header = document.createElement('div');
        header.className = 'explain-header';

        const title = document.createElement('h2');
        title.textContent = '模型小白解碼器';
        header.appendChild(title);

        // 工具列
        const toolbar = document.createElement('div');
        toolbar.className = 'explain-toolbar';

        // 重新掃描按鈕
        const rescanBtn = document.createElement('button');
        rescanBtn.className = 'explain-btn rescan-btn';
        rescanBtn.textContent = '重新掃描與校驗';
        rescanBtn.title = '重新分析模型並執行一致性檢查';
        rescanBtn.addEventListener('click', () => {
            this.handleRescan();
        });
        toolbar.appendChild(rescanBtn);

        // 狀態指示
        const status = document.createElement('div');
        status.className = 'explain-status';

        if (analysisResult.validationResult) {
            const validation = analysisResult.validationResult;
            status.className += validation.isValid ? ' status-valid' : ' status-invalid';
            status.textContent = validation.isValid ? '✓ 已驗證' : '✗ 需檢查';
            status.title = validation.message || '';
        } else {
            status.className += ' status-unknown';
            status.textContent = '○ 未驗證';
        }
        toolbar.appendChild(status);

        // Raw summary toggle 按鈕
        const rawToggleBtn = document.createElement('button');
        rawToggleBtn.className = 'explain-btn raw-toggle-btn';
        rawToggleBtn.textContent = 'Raw Summary';
        rawToggleBtn.title = '顯示/隱藏模型原始摘要 (JSON)';
        rawToggleBtn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('explain-toggle-raw-summary'));
        });
        toolbar.appendChild(rawToggleBtn);

        header.appendChild(toolbar);
        return header;
    }

    /**
     * 渲染原始 summary 區塊（收合）
     */
    renderRawSummary(analysisResult) {
        const section = document.createElement('div');
        section.className = 'explain-section raw-summary-section';
        section.style.display = 'none';

        const title = document.createElement('h3');
        title.textContent = 'Raw Summary (JSON)';
        section.appendChild(title);

        const content = document.createElement('div');
        content.className = 'explain-section-content raw-summary-content';

        const pre = document.createElement('pre');
        pre.className = 'raw-summary-pre';

        // 優先從 globalThis 讀取 (DevTools 可用)，否則使用 analysisResult.summary
        let summary = null;
        try {
            summary = (typeof globalThis !== 'undefined' && globalThis.__MODEL_SUMMARY__) ? globalThis.__MODEL_SUMMARY__ : analysisResult.summary;
        } catch (e) {
            summary = analysisResult.summary;
        }

        pre.textContent = JSON.stringify(summary, null, 2);
        content.appendChild(pre);
        section.appendChild(content);

        // 監聽 toggle 事件
        document.addEventListener('explain-toggle-raw-summary', () => {
            section.style.display = section.style.display === 'none' ? 'block' : 'none';
        });

        return section;
    }

    /**
     * 渲染模型概述
     */
    renderOverview(summary) {
        const section = document.createElement('div');
        section.className = 'explain-section';

        const title = document.createElement('h3');
        title.textContent = '模型概述';
        section.appendChild(title);

        const content = document.createElement('div');
        content.className = 'explain-section-content';

        // 模型名稱
        const nameField = this.createField('模型名稱', summary.modelName, 'model', 1.0);
        content.appendChild(nameField);

        // 格式
        const formatField = this.createField('格式', summary.format.toUpperCase(), 'model', 1.0);
        content.appendChild(formatField);

        // 算子統計
        const opsInfo = `總計 ${summary.operators.total} 個算子`;
        const opsField = this.createField('算子', opsInfo, 'graph_scan', 0.95);
        content.appendChild(opsField);

        section.appendChild(content);
        return section;
    }

    /**
     * 渲染輸入說明
     */
    renderInputs(inputs) {
        const section = document.createElement('div');
        section.className = 'explain-section';

        const title = document.createElement('h3');
        title.textContent = '輸入需求';
        section.appendChild(title);

        const content = document.createElement('div');
        content.className = 'explain-section-content';

        for (const input of inputs) {
            const inputDiv = document.createElement('div');
            inputDiv.className = 'input-item';

            // 輸入名稱
            const nameField = this.createField('名稱', input.name, 'model', 1.0);
            inputDiv.appendChild(nameField);

            // 形狀
            const shapeText = Array.isArray(input.shape) ? `[${input.shape.join(', ')}]` : String(input.shape);
            const shapeField = this.createField('形狀', shapeText, 'model', 1.0);
            inputDiv.appendChild(shapeField);

            // 資料類型
            const dtypeField = this.createField('資料類型', input.dtype, 'model', 1.0);
            inputDiv.appendChild(dtypeField);

            // 領域（可能是推斷的）
            const domainField = this.createField('領域', input.domain, input.provenance, input.confidence);
            inputDiv.appendChild(domainField);

            content.appendChild(inputDiv);
        }

        section.appendChild(content);
        return section;
    }

    /**
     * 渲染輸出說明
     */
    renderOutputs(outputs) {
        const section = document.createElement('div');
        section.className = 'explain-section';

        const title = document.createElement('h3');
        title.textContent = '輸出說明';
        section.appendChild(title);

        const content = document.createElement('div');
        content.className = 'explain-section-content';

        for (const output of outputs) {
            const outputDiv = document.createElement('div');
            outputDiv.className = 'output-item';

            // 輸出名稱
            const nameField = this.createField('名稱', output.name, 'model', 1.0);
            outputDiv.appendChild(nameField);

            // 形狀
            const shapeText = Array.isArray(output.shape) ? `[${output.shape.join(', ')}]` : String(output.shape);
            const shapeField = this.createField('形狀', shapeText, 'model', 1.0);
            outputDiv.appendChild(shapeField);

            // 語意（可能是推斷的）
            const semanticsField = this.createField('語意', output.semantics, output.provenance, output.confidence);
            outputDiv.appendChild(semanticsField);

            content.appendChild(outputDiv);
        }

        section.appendChild(content);
        return section;
    }

    /**
     * 渲染任務類型
     */
    renderTaskType(taskGuess) {
        const section = document.createElement('div');
        section.className = 'explain-section';

        const title = document.createElement('h3');
        title.textContent = '任務類型';
        section.appendChild(title);

        const content = document.createElement('div');
        content.className = 'explain-section-content';

        let confidence, provenance, taskValue;
        if (typeof taskGuess === 'object') {
            taskValue = taskGuess.value;
            provenance = taskGuess.provenance;
            confidence = taskGuess.confidence;
        } else {
            taskValue = taskGuess;
            provenance = 'heuristic';
            confidence = 0.5;
        }

        const taskField = this.createField('推斷任務', taskValue, provenance, confidence);
        content.appendChild(taskField);

        section.appendChild(content);
        return section;
    }

    /**
     * 渲染量化資訊
     */
    renderQuantization(quantization) {
        const section = document.createElement('div');
        section.className = 'explain-section';

        const title = document.createElement('h3');
        title.textContent = '量化資訊';
        section.appendChild(title);

        const content = document.createElement('div');
        content.className = 'explain-section-content';

        let confidence, isQuantized, precision, provenance;
        if (typeof quantization === 'object' && quantization.provenance) {
            isQuantized = quantization.isQuantized;
            precision = quantization.precision;
            provenance = quantization.provenance;
            confidence = quantization.confidence;
        } else {
            isQuantized = quantization.isQuantized || false;
            precision = quantization.precision || 'fp32';
            provenance = 'graph_scan';
            confidence = 0.9;
        }

        const quantField = this.createField('量化狀態', isQuantized ? '已量化' : '未量化', provenance, confidence);
        content.appendChild(quantField);

        const precisionField = this.createField('精度', precision, provenance, confidence);
        content.appendChild(precisionField);

        if (quantization.observed && quantization.observed.length > 0) {
            const observedField = this.createField('偵測到算子', quantization.observed.join(', '), provenance, confidence);
            content.appendChild(observedField);
        }

        section.appendChild(content);
        return section;
    }

    /**
     * 渲染使用指南
     */
    renderUsageGuide(explanation) {
        const section = document.createElement('div');
        section.className = 'explain-section';

        const title = document.createElement('h3');
        title.textContent = '使用指南';
        section.appendChild(title);

        const content = document.createElement('div');
        content.className = 'explain-section-content';

        if (explanation.purpose) {
            const purposeField = this.createField('用途', explanation.purpose, 'inferred', 0.7);
            content.appendChild(purposeField);
        }

        if (explanation.applications && explanation.applications.length > 0) {
            const appsField = this.createField('應用場景', explanation.applications.join('; '), 'inferred', 0.6);
            content.appendChild(appsField);
        }

        section.appendChild(content);
        return section;
    }

    /**
     * 創建欄位
     */
    createField(label, value, provenance, confidence) {
        const field = document.createElement('div');
        field.className = 'explain-field';

        const labelEl = document.createElement('div');
        labelEl.className = 'explain-field-label';
        labelEl.textContent = label;
        field.appendChild(labelEl);

        const valueContainer = document.createElement('div');
        valueContainer.className = 'explain-field-value';

        this.renderFieldWithBadge(value, provenance, confidence, valueContainer);
        field.appendChild(valueContainer);

        return field;
    }

    /**
     * 處理重新掃描
     */
    handleRescan() {
        // 觸發重新掃描事件
        const event = new CustomEvent('explain-rescan', {
            detail: { timestamp: Date.now() }
        });
        document.dispatchEvent(event);
    }

    /**
     * 加入樣式
     */
    addStyles() {
        if (document.getElementById('explain-ui-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'explain-ui-styles';
        style.textContent = `
            .explain-panel {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
                font-size: 12px;
                line-height: 1.4;
                height: 100%;
                display: flex;
                flex-direction: column;
            }

            .explain-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
                flex-shrink: 0;
            }

            .explain-header h2 {
                margin: 0 0 12px 0;
                font-size: 16px;
                font-weight: 600;
                color: #1a1a1a;
            }

            .explain-toolbar {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .explain-btn {
                padding: 6px 12px;
                border: 1px solid #d0d7de;
                border-radius: 6px;
                background: #f6f8fa;
                color: #24292f;
                font-size: 11px;
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .explain-btn:hover {
                background: #f3f4f6;
            }

            .rescan-btn {
                background: #0969da;
                color: white;
                border-color: #0969da;
            }

            .rescan-btn:hover {
                background: #0550ae;
            }

            .explain-status {
                font-size: 11px;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: 500;
            }

            .explain-status.status-valid {
                background: #dafbe1;
                color: #116329;
            }

            .explain-status.status-invalid {
                background: #ffebe9;
                color: #cf222e;
            }

            .explain-status.status-unknown {
                background: #f6f8fa;
                color: #656d76;
            }

            .explain-content {
                padding: 0;
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
            }

            .explain-section {
                border-bottom: 1px solid #e0e0e0;
            }

            .explain-section:last-child {
                border-bottom: none;
            }

            .explain-section h3 {
                margin: 0;
                padding: 12px 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                background: #f8f9fa;
                color: #656d76;
                border-bottom: 1px solid #e0e0e0;
            }

            .explain-section-content {
                padding: 12px 20px;
            }

            .explain-field {
                display: flex;
                margin-bottom: 8px;
                min-height: 20px;
                align-items: flex-start;
            }

            .explain-field:last-child {
                margin-bottom: 0;
            }

            .explain-field-label {
                min-width: 80px;
                max-width: 80px;
                font-size: 11px;
                color: #656d76;
                padding-right: 8px;
                padding-top: 2px;
                flex-shrink: 0;
            }

            .explain-field-value {
                flex: 1;
                min-width: 0;
            }

            .field-with-badge {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }

            .field-content {
                font-size: 11px;
                color: #24292f;
                word-break: break-word;
                flex: 1;
                min-width: 0;
            }

            .provenance-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 12px;
                font-size: 9px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                white-space: nowrap;
                cursor: help;
            }

            .provenance-green {
                background: #dafbe1;
                color: #116329;
            }

            .provenance-yellow {
                background: #fff8c5;
                color: #7d4e00;
            }

            .provenance-blue {
                background: #dbeafe;
                color: #0550ae;
            }

            .input-item,
            .output-item {
                padding: 8px 0;
                border-bottom: 1px solid #f1f3f4;
            }

            .input-item:last-child,
            .output-item:last-child {
                border-bottom: none;
            }

            /* 深色主題 */
            .theme-dark .explain-header {
                background: #3a3a3a;
                border-bottom-color: #555;
            }

            .theme-dark .explain-header h2 {
                color: #e0e0e0;
            }

            .theme-dark .explain-section h3 {
                background: #3a3a3a;
                color: #aaa;
                border-bottom-color: #555;
            }

            .theme-dark .explain-section {
                border-bottom-color: #555;
            }

            .theme-dark .explain-field-label {
                color: #aaa;
            }

            .theme-dark .field-content {
                color: #e0e0e0;
            }

            .theme-dark .explain-btn {
                background: #404040;
                color: #e0e0e0;
                border-color: #555;
            }

            .theme-dark .explain-btn:hover {
                background: #4a4a4a;
            }

            .theme-dark .rescan-btn {
                background: #0969da;
                color: white;
                border-color: #0969da;
            }

            .theme-dark .input-item,
            .theme-dark .output-item {
                border-bottom-color: #444;
            }
        `;

        document.head.appendChild(style);
    }
}
