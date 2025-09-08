// 詳細測試 ModelSummarizer 的張量解析功能
import { ModelSummarizer } from './source/explain/summarizer.js';

console.log('🔍 開始測試 ModelSummarizer 張量解析...');

// 模擬 Netron 真實張量結構
const mockNetronTensors = [
    // ONNX 格式 - 來自真實 Netron 物件
    {
        name: 'input.1',
        arguments: [
            {
                type: {
                    dataType: 'float32',
                    shape: {
                        dimensions: [1, 256, 256, 3]
                    }
                }
            }
        ],
        toString: () => 'float32[1,256,256,3]'
    },

    // TensorFlow 格式
    {
        name: 'input',
        dtype: 'float32',
        shape: [1, 224, 224, 3],
        type: {
            dtype: 'DT_FLOAT',
            shape: {
                dim: [
                    { size: 1 },
                    { size: 224 },
                    { size: 224 },
                    { size: 3 }
                ]
            }
        }
    },

    // PyTorch 格式
    {
        name: 'x',
        dtype: 'torch.float32',
        shape: [1, 3, 224, 224],
        scalar_type: 'Float'
    }
];

const summarizer = new ModelSummarizer();

// 測試每個張量
mockNetronTensors.forEach((tensor, index) => {
    console.log(`\n=== 測試張量 ${index + 1}: ${tensor.name} ===`);

    // 測試形狀解析
    console.log('原始張量:', tensor);
    const shape = summarizer._parseShape(tensor);
    const dtype = summarizer._parseDtype(tensor);

    console.log('解析結果:');
    console.log('- 形狀:', shape);
    console.log('- 資料類型:', dtype);

    // 顯示期望值
    const expectedShape = tensor.shape ||
                         tensor.arguments?.[0]?.type?.shape?.dimensions ||
                         'unknown';
    const expectedDtype = tensor.dtype ||
                         tensor.arguments?.[0]?.type?.dataType ||
                         'unknown';

    console.log('期望結果:');
    console.log('- 形狀:', expectedShape);
    console.log('- 資料類型:', expectedDtype);

    // 驗證結果
    const shapeMatch = JSON.stringify(shape) === JSON.stringify(expectedShape);
    const dtypeMatch = dtype.includes(expectedDtype) || expectedDtype.includes(dtype);

    console.log('驗證結果:');
    console.log('- 形狀匹配:', shapeMatch ? '✅' : '❌');
    console.log('- 類型匹配:', dtypeMatch ? '✅' : '❌');
});

console.log('\n🏁 測試完成');
