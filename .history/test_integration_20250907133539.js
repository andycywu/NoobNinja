#!/usr/bin/env node

/**
 * NoobNinja 整合測試腳本
 * 用於驗證所有新功能是否正常運行
 */

const fs = require('fs');
const path = require('path');

const checkFileExists = function(filePath) {
    return fs.existsSync(filePath);
};

const checkFileContent = function(filePath, searchText) {
    if (!checkFileExists(filePath)) {
        return false;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes(searchText);
};

const runTests = function() {
    process.stdout.write('🚀 開始 NoobNinja 整合測試...\n');

    const tests = [
        {
            name: '檢查品牌更新 (package.json)',
            test: () => checkFileContent('package.json', 'NoobNinja'),
            fix: '需要更新 package.json 中的產品名稱'
        },
        {
            name: '檢查設定系統模組',
            test: () => checkFileExists('source/ui/settings.js'),
            fix: '需要創建 source/ui/settings.js'
        },
        {
            name: '檢查解釋 UI 渲染器',
            test: () => checkFileExists('source/ui/explain-renderer.js'),
            fix: '需要創建 source/ui/explain-renderer.js'
        },
        {
            name: '檢查摘要器更新',
            test: () => checkFileContent('source/explain/summarizer.js', 'provenance'),
            fix: '需要在摘要器中添加溯源追蹤'
        },
        {
            name: '檢查驗證器更新',
            test: () => checkFileContent('source/explain/validator.js', '_validateProvenance'),
            fix: '需要在驗證器中添加溯源驗證'
        },
        {
            name: '檢查主 View 整合',
            test: () => checkFileContent('source/view.js', 'showSettings'),
            fix: '需要在 view.js 中添加設定功能'
        },
        {
            name: '檢查設定按鈕 HTML',
            test: () => checkFileContent('source/index.html', 'sidebar-settings-button'),
            fix: '需要在 index.html 中添加設定按鈕'
        },
        {
            name: '檢查主題 CSS',
            test: () => checkFileContent('source/index.html', 'confidence-badge'),
            fix: '需要在 index.html 中添加主題和徽章 CSS'
        },
        {
            name: '檢查中文本地化',
            test: () => checkFileContent('source/index.html', '模型小白解碼器'),
            fix: '需要添加中文本地化'
        }
    ];

    let passed = 0;
    let failed = 0;

    tests.forEach((test, index) => {
        const result = test.test();
        if (result) {
            process.stdout.write(`✅ ${index + 1}. ${test.name}\n`);
            passed++;
        } else {
            process.stdout.write(`❌ ${index + 1}. ${test.name}\n`);
            process.stdout.write(`   💡 修復建議: ${test.fix}\n`);
            failed++;
        }
    });

    process.stdout.write(`\n📊 測試結果: ${passed} 通過, ${failed} 失敗\n`);

    if (failed === 0) {
        process.stdout.write('🎉 所有測試通過！NoobNinja 已經準備好了！\n');
        process.stdout.write('\n🚀 下一步:\n');
        process.stdout.write('1. 運行 npm start 啟動應用\n');
        process.stdout.write('2. 載入一個模型文件進行測試\n');
        process.stdout.write('3. 測試解釋功能和設定面板\n');
    } else {
        process.stderr.write('⚠️  請修復失敗的項目後重新測試\n');
    }
};

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
