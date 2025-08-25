# Cetus AMM 前端集成文档

## 项目概览

Cetus AMM 是一个部署在 Sui 测试网上的去中心化自动做市商协议。本文档为前端开发者提供完整的集成指南，包括不同的使用场景和代码示例。

## 基础配置

### 合约地址信息

```javascript
const CONTRACT_CONFIG = {
  // 合约包地址
  packageId: "0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138",
  
  // 全局暂停状态对象（共享对象）
  globalPauseStatusId: "0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b",
  
  // 管理员权限对象（仅管理员拥有）
  adminCapId: "0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e",
  
  // 升级权限对象（仅管理员拥有）
  upgradeCapId: "0x64db96d87ef347cda46d3a0a53a9ad1fbdfc074ffa158e4f53b26389604ae238",
  
  // 网络配置
  network: "testnet",
  rpc: "https://fullnode.testnet.sui.io:443"
};
```

### Sui Client 初始化

```javascript
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';

// 初始化 Sui 客户端
const suiClient = new SuiClient({ 
  url: CONTRACT_CONFIG.rpc 
});

// 初始化钱包（示例使用 Ed25519Keypair）
const keypair = Ed25519Keypair.generate();
const userAddress = keypair.getPublicKey().toSuiAddress();
```

## 使用场景详解

### 场景一：管理员创建交易对

**适用对象**: 协议管理员  
**用途**: 创建新的代币交易对，设置手续费和其他参数

```javascript
/**
 * 创建新的交易对
 * @param {string} coinTypeA - 代币A的类型
 * @param {string} coinTypeB - 代币B的类型
 * @param {number} feeRate - 手续费率（基点，如30表示0.3%）
 * @param {number} tickSpacing - tick间距
 * @param {number} sqrtPriceX64 - 初始价格（sqrt格式）
 */
async function createPool(coinTypeA, coinTypeB, feeRate = 30, tickSpacing = 1000, sqrtPriceX64 = 1) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::init_pool`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(CONTRACT_CONFIG.adminCapId),  // AdminCap
        txb.pure(feeRate),                       // 手续费率
        txb.pure(tickSpacing),                   // tick间距
        txb.pure(sqrtPriceX64),                  // 初始价格
        txb.pure(6)                              // 手续费协议比例
      ]
    });
    
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true
      }
    });
    
    console.log('交易对创建成功:', result.digest);
    
    // 从结果中提取Pool对象ID
    const poolObject = result.objectChanges?.find(
      obj => obj.type === 'created' && obj.objectType.includes('Pool')
    );
    
    return {
      success: true,
      poolId: poolObject?.objectId,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('创建交易对失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 使用示例
const result = await createPool(
  '0x2::sui::SUI',                    // SUI代币
  '0x123::usdc::USDC',                // USDC代币（示例地址）
  30,                                 // 0.3% 手续费
  1000,                              // tick间距
  79228162514264337593543950336      // 初始价格 1:1
);
```

### 场景二：用户添加流动性

**适用对象**: 普通用户  
**用途**: 向交易对添加流动性以获得手续费收益

```javascript
/**
 * 添加流动性
 * @param {string} poolId - 交易对ID
 * @param {string} coinAId - 代币A对象ID
 * @param {string} coinBId - 代币B对象ID
 * @param {number} amountA - 代币A数量
 * @param {number} amountB - 代币B数量
 * @param {number} minAmountA - 最小接受的代币A数量
 * @param {number} minAmountB - 最小接受的代币B数量
 */
async function addLiquidity(poolId, coinAId, coinBId, amountA, amountB, minAmountA, minAmountB) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::add_liquidity`,
      typeArguments: [coinTypeA, coinTypeB], // 需要根据实际代币类型填入
      arguments: [
        txb.object(poolId),                           // Pool对象
        txb.object(CONTRACT_CONFIG.globalPauseStatusId), // 全局暂停状态
        txb.object(coinAId),                          // 代币A
        txb.object(coinBId),                          // 代币B
        txb.pure(amountA),                            // 代币A数量
        txb.pure(amountB),                            // 代币B数量
        txb.pure(minAmountA),                         // 最小代币A
        txb.pure(minAmountB)                          // 最小代币B
      ]
    });
    
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true
      }
    });
    
    console.log('添加流动性成功:', result.digest);
    
    // 提取LP代币对象ID
    const lpTokenObject = result.objectChanges?.find(
      obj => obj.type === 'created' && obj.objectType.includes('LpToken')
    );
    
    return {
      success: true,
      lpTokenId: lpTokenObject?.objectId,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('添加流动性失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 场景三：用户进行代币交换

**适用对象**: 普通用户  
**用途**: 将一种代币兑换成另一种代币

```javascript
/**
 * 精确输入代币A换取代币B
 * @param {string} poolId - 交易对ID
 * @param {string} coinAId - 输入代币A对象ID
 * @param {number} amountIn - 输入数量
 * @param {number} minAmountOut - 最小输出数量
 */
async function swapExactAForB(poolId, coinAId, amountIn, minAmountOut) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::swap_exact_coinA_for_coinB`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(poolId),                           // Pool对象
        txb.object(CONTRACT_CONFIG.globalPauseStatusId), // 全局暂停状态
        txb.object(coinAId),                          // 输入代币A
        txb.pure(amountIn),                           // 输入数量
        txb.pure(minAmountOut)                        // 最小输出数量
      ]
    });
    
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true
      }
    });
    
    console.log('代币交换成功:', result.digest);
    
    // 提取输出代币B对象ID
    const coinBObject = result.objectChanges?.find(
      obj => obj.type === 'created' && obj.objectType.includes(coinTypeB)
    );
    
    return {
      success: true,
      outputCoinId: coinBObject?.objectId,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('代币交换失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 精确输出代币B，输入代币A
 * @param {string} poolId - 交易对ID
 * @param {string} coinAId - 输入代币A对象ID
 * @param {number} amountOut - 期望输出数量
 * @param {number} maxAmountIn - 最大输入数量
 */
async function swapAForExactB(poolId, coinAId, amountOut, maxAmountIn) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::swap_coinA_for_exact_coinB`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(poolId),
        txb.object(CONTRACT_CONFIG.globalPauseStatusId),
        txb.object(coinAId),
        txb.pure(maxAmountIn),
        txb.pure(amountOut)
      ]
    });
    
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true
      }
    });
    
    return {
      success: true,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('精确输出交换失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 场景四：用户移除流动性

**适用对象**: 流动性提供者  
**用途**: 移除之前添加的流动性并获得代币

```javascript
/**
 * 移除流动性
 * @param {string} poolId - 交易对ID
 * @param {string} lpTokenId - LP代币对象ID
 * @param {number} liquidity - 要移除的流动性数量
 * @param {number} minAmountA - 最小接受的代币A数量
 * @param {number} minAmountB - 最小接受的代币B数量
 */
async function removeLiquidity(poolId, lpTokenId, liquidity, minAmountA, minAmountB) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::remove_liquidity`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(poolId),                           // Pool对象
        txb.object(CONTRACT_CONFIG.globalPauseStatusId), // 全局暂停状态
        txb.object(lpTokenId),                        // LP代币
        txb.pure(liquidity),                          // 流动性数量
        txb.pure(minAmountA),                         // 最小代币A
        txb.pure(minAmountB)                          // 最小代币B
      ]
    });
    
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true
      }
    });
    
    console.log('移除流动性成功:', result.digest);
    
    return {
      success: true,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('移除流动性失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 场景五：多跳交换（路由功能）

**适用对象**: 需要最优价格的用户  
**用途**: 通过多个交易对实现更好的交换价格

```javascript
/**
 * 多跳代币交换
 * @param {Array} pools - 交易对路径
 * @param {Array} coinTypes - 代币类型路径
 * @param {string} inputCoinId - 输入代币对象ID
 * @param {number} amountIn - 输入数量
 * @param {number} minAmountOut - 最小输出数量
 */
async function multiHopSwap(pools, coinTypes, inputCoinId, amountIn, minAmountOut) {
  try {
    const txb = new TransactionBlock();
    
    // 构建多跳交换路径
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_router::swap_exact_input`,
      typeArguments: coinTypes,
      arguments: [
        txb.makeMoveVec({ objects: pools.map(pool => txb.object(pool)) }),
        txb.object(CONTRACT_CONFIG.globalPauseStatusId),
        txb.object(inputCoinId),
        txb.pure(amountIn),
        txb.pure(minAmountOut)
      ]
    });
    
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true
      }
    });
    
    console.log('多跳交换成功:', result.digest);
    
    return {
      success: true,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('多跳交换失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 使用示例：SUI -> USDC -> USDT
const swapPath = [
  'poolId_SUI_USDC',
  'poolId_USDC_USDT'
];
const tokenPath = [
  '0x2::sui::SUI',
  '0x123::usdc::USDC',
  '0x456::usdt::USDT'
];

await multiHopSwap(swapPath, tokenPath, 'coinSuiId', 1000000000, 900000); // 1 SUI -> 至少0.9 USDT
```

## 查询功能

### 获取交易对信息

```javascript
/**
 * 获取交易对详细信息
 * @param {string} poolId - 交易对ID
 */
async function getPoolInfo(poolId) {
  try {
    const poolObject = await suiClient.getObject({
      id: poolId,
      options: {
        showContent: true,
        showType: true
      }
    });
    
    if (poolObject.data?.content?.dataType === 'moveObject') {
      const fields = poolObject.data.content.fields;
      
      return {
        coinTypeA: fields.coin_type_a,
        coinTypeB: fields.coin_type_b,
        reserveA: fields.reserve_a,
        reserveB: fields.reserve_b,
        totalSupply: fields.lp_supply,
        feeRate: fields.fee_rate,
        protocolFeeRate: fields.protocol_fee_rate
      };
    }
    
    throw new Error('无法获取交易对信息');
    
  } catch (error) {
    console.error('获取交易对信息失败:', error);
    throw error;
  }
}
```

### 计算交换价格

```javascript
/**
 * 计算交换输出数量（不执行交易）
 * @param {number} amountIn - 输入数量
 * @param {number} reserveIn - 输入代币储备量
 * @param {number} reserveOut - 输出代币储备量
 * @param {number} feeRate - 手续费率（基点）
 */
function calculateAmountOut(amountIn, reserveIn, reserveOut, feeRate = 30) {
  const amountInWithFee = amountIn * (10000 - feeRate);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000 + amountInWithFee;
  return Math.floor(numerator / denominator);
}

/**
 * 获取交换报价
 * @param {string} poolId - 交易对ID
 * @param {number} amountIn - 输入数量
 * @param {boolean} swapAForB - 是否是A换B
 */
async function getSwapQuote(poolId, amountIn, swapAForB = true) {
  try {
    const poolInfo = await getPoolInfo(poolId);
    
    const [reserveIn, reserveOut] = swapAForB 
      ? [poolInfo.reserveA, poolInfo.reserveB]
      : [poolInfo.reserveB, poolInfo.reserveA];
    
    const amountOut = calculateAmountOut(
      amountIn, 
      parseInt(reserveIn), 
      parseInt(reserveOut), 
      poolInfo.feeRate
    );
    
    const priceImpact = calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);
    
    return {
      amountOut,
      priceImpact,
      feeAmount: Math.floor(amountIn * poolInfo.feeRate / 10000),
      exchangeRate: amountOut / amountIn
    };
    
  } catch (error) {
    console.error('获取交换报价失败:', error);
    throw error;
  }
}

/**
 * 计算价格冲击
 */
function calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut) {
  const preBuyPrice = reserveOut / reserveIn;
  const postBuyPrice = (reserveOut - amountOut) / (reserveIn + amountIn);
  return Math.abs((postBuyPrice - preBuyPrice) / preBuyPrice) * 100;
}
```

### 获取用户余额

```javascript
/**
 * 获取用户代币余额
 * @param {string} userAddress - 用户地址
 * @param {string} coinType - 代币类型
 */
async function getUserBalance(userAddress, coinType) {
  try {
    const coins = await suiClient.getCoins({
      owner: userAddress,
      coinType: coinType
    });
    
    const totalBalance = coins.data.reduce((sum, coin) => 
      sum + parseInt(coin.balance), 0
    );
    
    return {
      totalBalance,
      coinCount: coins.data.length,
      coins: coins.data
    };
    
  } catch (error) {
    console.error('获取余额失败:', error);
    throw error;
  }
}
```

## 错误处理和最佳实践

### 常见错误处理

```javascript
/**
 * 通用错误处理函数
 */
function handleTransactionError(error) {
  const errorMessage = error.message || error.toString();
  
  // 常见错误类型
  if (errorMessage.includes('InsufficientBalance')) {
    return '余额不足';
  } else if (errorMessage.includes('SlippageTooHigh')) {
    return '滑点过高，请调整参数';
  } else if (errorMessage.includes('PoolPaused')) {
    return '交易对已暂停';
  } else if (errorMessage.includes('MinAmountNotMet')) {
    return '输出数量低于最小值';
  } else if (errorMessage.includes('DeadlineExceeded')) {
    return '交易超时';
  } else {
    return `交易失败: ${errorMessage}`;
  }
}

/**
 * 带重试机制的交易执行
 */
async function executeTransactionWithRetry(txb, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await suiClient.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: keypair,
        options: {
          showEffects: true,
          showObjectChanges: true
        }
      });
      
      // 检查交易是否成功
      if (result.effects?.status?.status === 'success') {
        return result;
      } else {
        throw new Error('交易执行失败');
      }
      
    } catch (error) {
      console.error(`交易尝试 ${i + 1} 失败:`, error);
      
      if (i === maxRetries - 1) {
        throw error; // 最后一次重试失败，抛出错误
      }
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 滑点保护

```javascript
/**
 * 计算带滑点保护的最小输出数量
 * @param {number} expectedAmount - 期望输出数量
 * @param {number} slippageTolerance - 滑点容忍度（百分比，如1表示1%）
 */
function calculateMinAmountWithSlippage(expectedAmount, slippageTolerance = 1) {
  return Math.floor(expectedAmount * (100 - slippageTolerance) / 100);
}

/**
 * 智能交换（带滑点保护）
 */
async function smartSwap(poolId, coinId, amountIn, slippageTolerance = 1) {
  try {
    // 1. 获取报价
    const quote = await getSwapQuote(poolId, amountIn, true);
    
    // 2. 计算最小输出（考虑滑点）
    const minAmountOut = calculateMinAmountWithSlippage(
      quote.amountOut, 
      slippageTolerance
    );
    
    // 3. 检查价格冲击
    if (quote.priceImpact > 5) { // 价格冲击超过5%
      const confirm = await confirmHighPriceImpact(quote.priceImpact);
      if (!confirm) {
        throw new Error('用户取消了高价格冲击的交易');
      }
    }
    
    // 4. 执行交换
    return await swapExactAForB(poolId, coinId, amountIn, minAmountOut);
    
  } catch (error) {
    console.error('智能交换失败:', error);
    throw error;
  }
}

// 价格冲击确认函数（需要根据前端框架实现）
async function confirmHighPriceImpact(priceImpact) {
  return confirm(`价格冲击较高 (${priceImpact.toFixed(2)}%)，是否继续？`);
}
```

### 交易状态监控

```javascript
/**
 * 监控交易状态
 * @param {string} transactionDigest - 交易哈希
 * @param {number} maxWaitTime - 最大等待时间（毫秒）
 */
async function waitForTransactionConfirmation(transactionDigest, maxWaitTime = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const txResult = await suiClient.getTransactionBlock({
        digest: transactionDigest,
        options: {
          showEffects: true
        }
      });
      
      if (txResult.effects?.status?.status === 'success') {
        console.log('交易确认成功:', transactionDigest);
        return { confirmed: true, result: txResult };
      } else if (txResult.effects?.status?.status === 'failure') {
        console.error('交易失败:', txResult.effects?.status?.error);
        return { confirmed: false, error: txResult.effects?.status?.error };
      }
      
    } catch (error) {
      console.log('交易还未确认，继续等待...');
    }
    
    // 等待2秒后再次检查
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('交易确认超时');
}
```

## React 组件示例

### 交换组件

```jsx
import React, { useState, useEffect } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';

const SwapComponent = () => {
  const { currentAccount, signAndExecuteTransactionBlock } = useWalletKit();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState('');

  // 获取报价
  useEffect(() => {
    if (fromAmount && selectedPool) {
      getSwapQuote(selectedPool, parseFloat(fromAmount) * 1e9)
        .then(setQuote)
        .catch(console.error);
    }
  }, [fromAmount, selectedPool]);

  // 更新输出数量
  useEffect(() => {
    if (quote) {
      setToAmount((quote.amountOut / 1e9).toString());
    }
  }, [quote]);

  const handleSwap = async () => {
    if (!currentAccount || !quote) return;

    setLoading(true);
    try {
      const result = await smartSwap(
        selectedPool,
        'coinAId', // 需要实际的coin对象ID
        parseFloat(fromAmount) * 1e9,
        1 // 1% 滑点
      );

      if (result.success) {
        alert('交换成功！');
        setFromAmount('');
        setToAmount('');
      } else {
        alert(`交换失败: ${result.error}`);
      }
    } catch (error) {
      alert(`交换失败: ${handleTransactionError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap-container">
      <h2>代币交换</h2>
      
      <div className="swap-form">
        <div className="input-group">
          <label>从</label>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="输入数量"
          />
          <select onChange={(e) => setSelectedPool(e.target.value)}>
            <option value="">选择交易对</option>
            <option value="poolId1">SUI/USDC</option>
            <option value="poolId2">USDC/USDT</option>
          </select>
        </div>

        <div className="input-group">
          <label>到</label>
          <input
            type="number"
            value={toAmount}
            readOnly
            placeholder="输出数量"
          />
        </div>

        {quote && (
          <div className="quote-info">
            <p>汇率: 1 = {quote.exchangeRate.toFixed(6)}</p>
            <p>手续费: {(quote.feeAmount / 1e9).toFixed(6)}</p>
            <p>价格冲击: {quote.priceImpact.toFixed(2)}%</p>
          </div>
        )}

        <button 
          onClick={handleSwap} 
          disabled={loading || !quote}
          className="swap-button"
        >
          {loading ? '交换中...' : '交换'}
        </button>
      </div>
    </div>
  );
};

export default SwapComponent;
```

### 流动性管理组件

```jsx
const LiquidityComponent = () => {
  const { currentAccount } = useWalletKit();
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [poolInfo, setPoolInfo] = useState(null);
  const [userLPBalance, setUserLPBalance] = useState(0);

  const handleAddLiquidity = async () => {
    if (!currentAccount || !poolInfo) return;

    try {
      const result = await addLiquidity(
        poolInfo.id,
        'coinAId', // 需要实际ID
        'coinBId', // 需要实际ID
        parseFloat(amountA) * 1e9,
        parseFloat(amountB) * 1e9,
        parseFloat(amountA) * 0.99 * 1e9, // 1% 滑点保护
        parseFloat(amountB) * 0.99 * 1e9
      );

      if (result.success) {
        alert('添加流动性成功！');
        // 更新余额
        updateUserLPBalance();
      }
    } catch (error) {
      alert(`添加流动性失败: ${handleTransactionError(error)}`);
    }
  };

  const updateUserLPBalance = async () => {
    if (currentAccount && poolInfo) {
      try {
        const balance = await getUserLPBalance(currentAccount.address, poolInfo.id);
        setUserLPBalance(balance);
      } catch (error) {
        console.error('获取LP余额失败:', error);
      }
    }
  };

  return (
    <div className="liquidity-container">
      <h2>流动性管理</h2>
      
      <div className="liquidity-form">
        <h3>添加流动性</h3>
        <input
          type="number"
          value={amountA}
          onChange={(e) => setAmountA(e.target.value)}
          placeholder="代币A数量"
        />
        <input
          type="number"
          value={amountB}
          onChange={(e) => setAmountB(e.target.value)}
          placeholder="代币B数量"
        />
        <button onClick={handleAddLiquidity}>
          添加流动性
        </button>
      </div>

      <div className="lp-info">
        <h3>我的流动性</h3>
        <p>LP代币余额: {(userLPBalance / 1e9).toFixed(6)}</p>
        <button onClick={() => removeLiquidity(/* 参数 */)}>
          移除流动性
        </button>
      </div>
    </div>
  );
};
```

## 部署后检查清单

### 上线前检查

1. **合约验证**
   - [ ] 合约地址正确
   - [ ] 所有对象ID有效
   - [ ] 网络配置正确

2. **功能测试**
   - [ ] 创建交易对功能正常
   - [ ] 添加流动性功能正常  
   - [ ] 代币交换功能正常
   - [ ] 移除流动性功能正常
   - [ ] 多跳交换功能正常

3. **安全检查**
   - [ ] 滑点保护机制生效
   - [ ] 价格冲击警告正常
   - [ ] 余额检查有效
   - [ ] 错误处理完善

4. **用户体验**
   - [ ] 交易状态实时更新
   - [ ] 错误信息清晰明确
   - [ ] 加载状态显示正常
   - [ ] 响应式设计适配

### 监控指标

```javascript
// 监控关键指标
const MONITORING_METRICS = {
  // 交易成功率
  transactionSuccessRate: 0.95, // 95%以上
  
  // 平均交易时间
  averageTransactionTime: 5000, // 5秒以内
  
  // 最大滑点容忍度
  maxSlippageTolerance: 5, // 5%
  
  // 最大价格冲击预警
  maxPriceImpactWarning: 3 // 3%
};

// 性能监控函数
function trackTransaction(type, startTime, result) {
  const duration = Date.now() - startTime;
  
  // 发送监控数据到分析服务
  analytics.track('transaction', {
    type,
    duration,
    success: result.success,
    error: result.error
  });
}
```

## 总结

本文档提供了 Cetus AMM 前端集成的完整指南，包括：

1. **基础配置**: 合约地址和客户端初始化
2. **五大核心场景**: 创建交易对、添加流动性、代币交换、移除流动性、多跳交换
3. **查询功能**: 获取交易对信息、计算价格、查询余额
4. **错误处理**: 常见错误类型和处理方案  
5. **最佳实践**: 滑点保护、交易监控、性能优化
6. **React组件**: 完整的前端组件示例
7. **部署检查**: 上线前的完整检查清单

通过本文档，前端开发者可以快速集成 Cetus AMM 协议，为用户提供完整的 DeFi 交易体验。

---

**技术支持**  
- 合约地址: `0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138`
- 测试网: Sui Testnet
- 文档更新: 2025年8月25日