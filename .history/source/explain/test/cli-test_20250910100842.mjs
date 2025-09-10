#!/usr/bin/env node

/**
 * NoobNinja 命令列測試工具
 * 用於在 Node.js 環境中測試 Explain 模組的基本功能
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🚀 NoobNinja 命令列測試工具\n');

// 測試顏色輸出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warn(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// 測試函數
async function testModuleLoading() {
    info('測試模組載入...');

    try {
        // 這裡我們不能直接載入瀏覽器模組，但可以檢查檔案存在性
        const modulePaths = [
            '../summarizer.js',
            '../rules.js',
            '../dummy-run.js',
            '../llm-providers.js',
            '../prompt.js',
            '../validator.js',
            '../exporter.js',
            '../index.js'
        ];

        for (const modulePath of modulePaths) {
            const fullPath = join(__dirname, modulePath);
            try {
                const content = readFileSync(fullPath, 'utf8');
                if (content.includes('export')) {
                    success(`${modulePath} - 檔案存在且包含匯出`);
                } else {
                    warn(`${modulePath} - 檔案存在但可能沒有正確的匯出`);
                }
            } catch (err) {
                error(`${modulePath} - 檔案不存在或無法讀取`);
            }
        }

    } catch (_err) {
        error(`模組載入測試失敗`);
    }
}

async function testConfigurationFiles() {
    info('檢查設定檔案...');

    const configFiles = [
        '../../package.json',
        '../../eslint.config.js'
    ];

    for (const configFile of configFiles) {
        const fullPath = join(__dirname, configFile);
        try {
            const content = readFileSync(fullPath, 'utf8');
            success(`${configFile} - 設定檔案存在`);

            if (configFile.includes('package.json')) {
                const pkg = JSON.parse(content);
                info(`  - 專案名稱: ${pkg.name || 'netron'}`);
                info(`  - 版本: ${pkg.version || 'unknown'}`);
            }
        } catch (_err) {
            error(`${configFile} - 設定檔案讀取失敗`);
        }
    }
}

async function testNetronIntegration() {
    info('檢查 Netron 整合...');

    try {
        const viewPath = join(__dirname, '../../view.js');
        const viewContent = readFileSync(viewPath, 'utf8');

        if (viewContent.includes('ExplainSidebar')) {
            success('view.js - 包含 ExplainSidebar 類別');
        } else {
            error('view.js - 未找到 ExplainSidebar 類別');
        }

        if (viewContent.includes('showExplainProperties')) {
            success('view.js - 包含 showExplainProperties 方法');
        } else {
            error('view.js - 未找到 showExplainProperties 方法');
        }

        // 檢查 HTML 檔案
        const htmlPath = join(__dirname, '../../index.html');
        const htmlContent = readFileSync(htmlPath, 'utf8');

        if (htmlContent.includes('Explain')) {
            success('index.html - 包含 Explain 相關元素');
        } else {
            warn('index.html - 未找到 Explain 相關元素');
        }

    } catch (_err) {
        error(`Netron 整合檢查失敗`);
    }
}

async function generateTestReport() {
    info('產生測試報告...');

    const report = {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.version,
        tests: []
    };

    // 這裡可以加入更多測試結果
    log('\n📊 測試摘要報告:', 'cyan');
    log(`測試時間: ${report.timestamp}`);
    log(`平台: ${report.platform}`);
    log(`Node.js 版本: ${report.nodeVersion}`);

    return report;
}

// 主測試流程
async function runTests() {
    log('🧪 開始 NoobNinja 測試流程\n', 'magenta');

    try {
        await testModuleLoading();
        console.log();

        await testConfigurationFiles();
        console.log();

        await testNetronIntegration();
        console.log();

        await generateTestReport();

        success('\n🎉 所有測試完成！');
        info('💡 提示: 使用瀏覽器測試頁面進行更詳細的功能測試');
        info('🌐 瀏覽器測試: http://localhost:8080/explain/test/index.html');

    } catch (err) {
        error(`測試過程發生錯誤: ${err.message}`);
        process.exit(1);
    }
}

// 如果直接執行此腳本
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runTests();
}

export { runTests, testModuleLoading, testConfigurationFiles, testNetronIntegration };
