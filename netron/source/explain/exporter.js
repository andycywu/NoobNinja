export class Exporter {
    constructor() { this.defaultTemplates = null; }
    async exportModelPackage(summary, explanation, options = {}) { const files = await this._generateFiles(summary, explanation, options); return this._createZipFile(files); }
    exportModelCard(summary, explanation, options = {}) { const templates = this._getDefaultTemplates(); const template = templates.readme; return template.replace('{modelName}', summary.modelName).replace('{format}', summary.format).replace('{taskGuess}', this._translateTask(summary.taskGuess)).replace('{purpose}', explanation.purpose || ''); }
    _getDefaultTemplates() { if (!this.defaultTemplates) { this.defaultTemplates = { readme: this._getReadmeTemplate(), quickstart: this._getQuickstartTemplate(), requirements: this._getRequirementsTemplate() }; } return this.defaultTemplates; }
    async _generateFiles(summary, explanation, options) { const files = []; files.push({ name: 'README.md', content: this.exportModelCard(summary, explanation, options) }); files.push({ name: 'quickstart.py', content: this.exportQuickstartCode(summary, explanation, 'python') }); files.push({ name: 'requirements.txt', content: this.exportRequirements(summary) }); files.push({ name: 'model_summary.json', content: JSON.stringify(summary, null, 2) }); return files; }
    async _createZipFile(files) { if (typeof window !== 'undefined' && window.JSZip) { return this._createZipWithJSZip(files); } return files; }
    exportQuickstartCode(summary, explanation, language='python') { const codeTemplate = explanation.quickstartCode?.[language]; if (codeTemplate) return codeTemplate; return this._generateDefaultCode(summary, language); }
    exportRequirements(summary) { const format = summary.format.toLowerCase(); const baseRequirements = this._getBaseRequirements(format); let requirements = baseRequirements.join('\n'); requirements += '\n\n# model info\n'; requirements += `# format: ${summary.format}\n`; return requirements; }
    _getReadmeTemplate() { return `# {modelName}\n\n> generated {date}\n\n## format\n\n{format}\n`; }
    _getQuickstartTemplate() { return `#!/usr/bin/env python3\n\n`; }
    _getRequirementsTemplate() { return `# requirements`; }
    _getBaseRequirements(format) { const requirements = { 'onnx': ['onnxruntime>=1.15.0','numpy>=1.21.0'], 'tflite': ['tensorflow>=2.12.0','numpy>=1.21.0'] }; return requirements[format] || ['numpy>=1.21.0']; }
    _generateDefaultCode(summary, language) { if (language === 'python') return this._generateDefaultPythonCode(summary); if (language === 'javascript') return this._generateDefaultJavaScriptCode(summary); return '# not supported'; }
    _generateDefaultPythonCode(summary) { return `# quickstart for ${summary.modelName}`; }
    _generateDefaultJavaScriptCode(summary) { return `// quickstart`; }
}
