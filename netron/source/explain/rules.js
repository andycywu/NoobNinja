/* eslint-disable no-unused-vars */
export class RulesEngine {
    constructor() {
        this.taskTemplates = {
            classification: this._getClassificationTemplate(),
            detection: this._getDetectionTemplate(),
            unknown: this._getUnknownTemplate()
        };
    }
    generateExplanation(summary) {
        const taskType = typeof summary.taskGuess === 'object' ? summary.taskGuess.value : summary.taskGuess;
        const template = this.taskTemplates[taskType] || this.taskTemplates.unknown;
        return { purpose: this._generatePurpose(summary, template), inputRequirements: this._generateInputRequirements(summary), outputMeaning: this._generateOutputMeaning(summary), applications: this._generateApplications(summary, template), quickstartCode: this._generateQuickstartCode(summary), limitations: this._generateLimitations(summary), performance: this._generatePerformanceNotes(summary) };
    }
    _generatePurpose(summary, template) { let purpose = template.purpose; purpose = purpose.replace('{format}', summary.format.toUpperCase()); purpose = purpose.replace('{precision}', summary.quantization.precision); purpose = purpose.replace('{modelName}', summary.modelName); return purpose; }
    _generateInputRequirements(summary) { const requirements = []; for (const input of summary.inputs) { requirements.push({ name: input.name, shape: input.shape, dtype: input.dtype, domain: input.domain, preprocessing: this._suggestPreprocessing(input), description: this._describeInput(input) }); } return requirements; }
    _generateOutputMeaning(summary) { const meanings = []; for (const output of summary.outputs) { meanings.push({ name: output.name, shape: output.shape, dtype: output.dtype, semantics: output.semantics, description: this._describeOutput(output, summary.taskGuess), postprocessing: this._suggestPostprocessing(output, summary.taskGuess) }); } return meanings; }
    _generateApplications(summary, template) { return template.applications; }
    _generateQuickstartCode(summary) { const format = summary.format.toLowerCase(); switch (format) { case 'onnx': return this._generateONNXCode(summary); default: return this._generateGenericCode(summary); } }
    _generateLimitations(summary) { const limitations = []; if (summary.quantization.isQuantized) { limitations.push('Quantized model may lose accuracy'); } for (const input of summary.inputs) { if (input.shape.includes('?') || input.shape.includes(-1)) { limitations.push('Model contains dynamic dimensions'); } } return limitations; }
    _generatePerformanceNotes(summary) { const notes = []; if (summary.operators && summary.operators.total > 1000) notes.push('Model is complex and may require longer inference time'); if (summary.runtimeHints && summary.runtimeHints.length > 0) notes.push(`Suggested runtimes: ${summary.runtimeHints.slice(0,3).join(', ')}`); if (!summary.quantization.isQuantized) notes.push('Consider quantization'); return notes; }
    _suggestPreprocessing(input) { const suggestions = []; if (input.domain === 'image') { suggestions.push('resize'); if (input.dtype.includes('float')) suggestions.push('normalize'); } if (input.domain === 'text') { suggestions.push('tokenize'); } return suggestions; }
    _suggestPostprocessing(output, taskGuess) { const suggestions = []; if (taskGuess === 'classification') { suggestions.push('softmax'); suggestions.push('argmax'); } if (taskGuess === 'detection' && output.semantics === 'bounding_boxes') { suggestions.push('nms'); } return suggestions; }
    _describeInput(input) { return `shape: [${input.shape.join(', ')}], dtype: ${input.dtype}`; }
    _describeOutput(output, taskGuess) { return output.semantics || `shape: [${output.shape.join(', ')}]`; }
    _generateONNXCode(summary) { return { python: '# onnx example' }; }
    _generateGenericCode(summary) { return { python: '# generic example' }; }
    _getClassificationTemplate() { return { purpose: 'This is a {format} classification model ({precision}) for {modelName}', applications: ['image classification','quality inspection'] }; }
    _getDetectionTemplate() { return { purpose: 'This is a {format} detection model ({precision}) for {modelName}', applications: ['object detection','autonomous driving'] }; }
    _getUnknownTemplate() { return { purpose: 'This is a {format} model ({precision})', applications: ['refer to model docs'] }; }
}
