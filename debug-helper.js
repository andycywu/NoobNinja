/**
 * Debug Helper - 在瀏覽器 Console 中使用的調試工具
 * 用法：在瀏覽器開發者工具的 Console 中複製貼上這些函數來調試
 */

// 檢查 localStorage 中的設定
window.debugSettings = function() {
    const settings = localStorage.getItem('noobninja_settings');
    console.log('💾 localStorage 中的設定:', settings ? JSON.parse(settings) : '無設定');

    // 手動啟用 LLM（供測試用）
    const enableLLM = {
        "llm.enabled": true,
        "llm.provider": "ollama",
        "llm.ollama.baseUrl": "http://localhost:11434",
        "llm.ollama.model": "llama3.2",
        "llm.allowNetwork": false
    };

    console.log('🔧 可用的手動啟用指令:');
    console.log(`localStorage.setItem("noobninja_settings", JSON.stringify(${JSON.stringify(enableLLM)}))`);
};

// 測試 Ollama 連線
window.debugOllama = async function() {
    console.log('🔍 測試 Ollama 連線...');

    try {
        // 檢查 API
        const tagsResponse = await fetch('http://localhost:11434/api/tags');
        console.log('📋 /api/tags 回應:', tagsResponse.status, tagsResponse.ok);

        if (tagsResponse.ok) {
            const tags = await tagsResponse.json();
            console.log('📋 可用模型:', tags.models?.map((m) => m.name));
        }

        // 測試生成
        const testResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2',
                prompt: '測試連線，請回應"連線正常"',
                stream: false
            })
        });

        console.log('🚀 /api/generate 回應:', testResponse.status, testResponse.ok);

        if (testResponse.ok) {
            const result = await testResponse.json();
            console.log('✅ 生成結果:', result.response);
        }

    } catch (error) {
        console.error('❌ Ollama 測試失敗:', error);
    }
};

// 檢查當前 Explain Engine 狀態
window.debugExplainEngine = function() {
    // 這個需要在 explain 功能打開後才能使用
    if (window.view && window.view._explainEngine) {
        console.log('🤖 ExplainEngine 狀態:', window.view._explainEngine.settings);
        console.log('🤖 LLM Providers:', window.view._explainEngine.llmProviders.providers);
    } else {
        console.log('⚠️ ExplainEngine 尚未初始化，請先打開解釋功能');
    }
};

// Debug 工具已載入。可從 console 執行以下函數以進行偵錯：
// - debugSettings() - 檢查設定
// - debugOllama() - 測試 Ollama 連線
// - debugExplainEngine() - 檢查 ExplainEngine 狀態
