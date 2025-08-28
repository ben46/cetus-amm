# SwapComponent.svelte - 代币交换组件

## 概述

`SwapComponent.svelte` 是 ApexYield AMM 前端应用的核心交易组件，提供用户友好的代币交换界面。支持实时报价获取、滑点保护、价格影响警告和安全的交换交易执行。

## 主要功能

### 🔄 代币交换
- 支持不同交易对的代币交换
- 精确输入数量交换（Exact Input）
- 实时计算输出数量

### 📊 智能报价
- 防抖机制获取实时报价
- 显示汇率、手续费和价格影响
- 自动更新输出数量

### 🛡️ 安全保护
- 可配置滑点保护
- 高价格影响警告和确认
- 交易前安全检查

### 🔀 用户体验
- 直观的代币切换按钮
- 加载状态和错误处理
- 成功/失败反馈

## API 接口

### Props（输入属性）

```javascript
export let wallet;          // 钱包对象
export let selectedPool = '';  // 选中的交易对ID
```

### 依赖服务

```javascript
import { swapExactAForB } from '../lib/ammFunctions.js';
import { getSwapQuote, calculateMinAmountWithSlippage } from '../lib/queries.js';
import { handleTransactionError } from '../lib/suiClient.js';
import { COMMON_COIN_TYPES, DEFAULT_SLIPPAGE_TOLERANCE } from '../lib/config.js';
```

## 核心实现

### 1. 实时报价获取

```javascript
// 响应式报价获取 - 当输入数量或池子改变时触发
$: if (fromAmount && selectedPool && !loading) {
  debounceGetQuote();
}

// 防抖报价函数 - 避免频繁API调用
let quoteTimeout;
function debounceGetQuote() {
  clearTimeout(quoteTimeout);
  quoteTimeout = setTimeout(async () => {
    try {
      error = '';
      const amountInWei = parseFloat(fromAmount) * 1e9;
      if (amountInWei > 0) {
        quote = await getSwapQuote(selectedPool, amountInWei, true);
      }
    } catch (err) {
      error = `Failed to get quote: ${err.message}`;
      quote = null;
    }
  }, 500); // 500ms防抖延迟
}

// 自动更新输出数量
$: if (quote) {
  toAmount = (quote.amountOut / 1e9).toFixed(6);
}
```

### 2. 交换执行逻辑

```javascript
async function handleSwap() {
  if (!wallet || !quote || !selectedPool) return;

  loading = true;
  error = '';
  success = '';

  try {
    const amountIn = parseFloat(fromAmount) * 1e9;
    const minAmountOut = calculateMinAmountWithSlippage(
      quote.amountOut, 
      slippageTolerance
    );

    // 高价格影响检查和用户确认
    if (quote.priceImpact > 5) {
      const confirmed = confirm(
        `High price impact (${quote.priceImpact.toFixed(2)}%). Continue?`
      );
      if (!confirmed) {
        loading = false;
        return;
      }
    }

    const selectedPoolInfo = availablePools.find(p => p.id === selectedPool);
    
    // 执行交换交易
    const result = await swapExactAForB(
      selectedPool,
      selectedPoolInfo.coinA,
      selectedPoolInfo.coinB,
      'coinAId', // 实际应用中需要真实的coin对象ID
      amountIn,
      minAmountOut,
      wallet.signer
    );

    if (result.success) {
      success = 'Swap successful!';
      fromAmount = '';
      toAmount = '';
      quote = null;
    } else {
      error = `Swap failed: ${result.error}`;
    }
  } catch (err) {
    error = handleTransactionError(err);
  } finally {
    loading = false;
  }
}
```

### 3. 代币切换功能

```javascript
function switchTokens() {
  [fromAmount, toAmount] = [toAmount, fromAmount];
  // 实际应用中还需要切换交易对方向
  // 可能需要更新 selectedPool 来反映新的交换方向
}
```

## 内部状态管理

### 核心状态变量

```javascript
let fromAmount = '';        // 用户输入的数量
let toAmount = '';         // 计算出的输出数量（只读）
let quote = null;          // 当前交换报价
let loading = false;       // 交换进行中状态
let error = '';           // 错误信息
let success = '';         // 成功信息
let slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE; // 滑点容忍度
```

### 报价对象结构

```javascript
const quote = {
  amountOut: Number,      // 输出数量（wei单位）
  priceImpact: Number,    // 价格影响百分比
  feeAmount: Number,      // 交易手续费（wei单位）
  exchangeRate: Number    // 汇率 (token B per token A)
};
```

### 交易对配置

```javascript
let availablePools = [
  { 
    id: 'pool1', 
    name: 'SUI/USDC', 
    coinA: COMMON_COIN_TYPES.SUI, 
    coinB: COMMON_COIN_TYPES.USDC 
  },
  { 
    id: 'pool2', 
    name: 'USDC/USDT', 
    coinA: COMMON_COIN_TYPES.USDC, 
    coinB: COMMON_COIN_TYPES.USDT 
  }
];
```

## UI 界面结构

### 主要交换表单

```svelte
<div class="swap-form">
  <!-- 输入代币 -->
  <div class="input-group">
    <label>From</label>
    <input
      type="number"
      bind:value={fromAmount}
      placeholder="Enter amount"
      step="0.000001"
      min="0"
    />
    <select bind:value={selectedPool}>
      <option value="">Select trading pair</option>
      {#each availablePools as pool}
        <option value={pool.id}>{pool.name}</option>
      {/each}
    </select>
  </div>

  <!-- 切换按钮 -->
  <div class="swap-arrow">
    <button type="button" on:click={switchTokens} class="switch-btn">⇅</button>
  </div>

  <!-- 输出代币 -->
  <div class="input-group">
    <label>To</label>
    <input
      type="number"
      bind:value={toAmount}
      placeholder="Output amount"
      readonly
    />
  </div>

  <!-- 滑点设置 -->
  <div class="input-group">
    <label>Slippage Tolerance (%)</label>
    <input
      type="number"
      bind:value={slippageTolerance}
      placeholder="1"
      step="0.1"
      min="0.1"
      max="10"
    />
  </div>
</div>
```

### 报价信息显示

```svelte
{#if quote}
  <div class="quote-info">
    <p><strong>Exchange Rate:</strong> 1 = {quote.exchangeRate.toFixed(6)}</p>
    <p><strong>Fee:</strong> {(quote.feeAmount / 1e9).toFixed(6)}</p>
    <p><strong>Price Impact:</strong> {quote.priceImpact.toFixed(2)}%</p>
    
    {#if quote.priceImpact > 3}
      <p class="warning">⚠️ High price impact</p>
    {/if}
  </div>
{/if}
```

### 交换按钮

```svelte
<button 
  on:click={handleSwap} 
  disabled={loading || !quote || !wallet}
  class="primary-button"
>
  {loading ? 'Swapping...' : 'Swap'}
</button>
```

## 安全特性

### 1. 滑点保护机制

```javascript
const minAmountOut = calculateMinAmountWithSlippage(
  quote.amountOut, 
  slippageTolerance
);

// 滑点容忍度范围控制
<input
  type="number"
  bind:value={slippageTolerance}
  step="0.1"
  min="0.1"    // 最小0.1%
  max="10"     // 最大10%
/>
```

### 2. 价格影响警告

```svelte
<!-- 中等价格影响警告 -->
{#if quote.priceImpact > 3}
  <p class="warning">⚠️ High price impact</p>
{/if}

<!-- 高价格影响确认对话框 -->
if (quote.priceImpact > 5) {
  const confirmed = confirm(`High price impact (${quote.priceImpact.toFixed(2)}%). Continue?`);
  if (!confirmed) return;
}
```

### 3. 输入验证

```javascript
// 数值验证
const amountInWei = parseFloat(fromAmount) * 1e9;
if (amountInWei <= 0) {
  error = "Please enter a valid amount";
  return;
}

// 钱包连接检查
if (!wallet || !wallet.connected) {
  error = "Please connect your wallet first";
  return;
}
```

## 使用示例

### 基本集成

```svelte
<script>
  import SwapComponent from './components/SwapComponent.svelte';
  
  let userWallet = null;
  let currentPool = '';
  
  function handleWalletConnected(event) {
    userWallet = event.detail;
  }
</script>

<!-- 只有钱包连接后才显示交换组件 -->
{#if userWallet}
  <SwapComponent 
    wallet={userWallet}
    bind:selectedPool={currentPool}
  />
{:else}
  <p>Please connect your wallet to start swapping</p>
{/if}
```

### 与交易监控集成

```svelte
<script>
  import SwapComponent from './components/SwapComponent.svelte';
  import TransactionMonitor from './components/TransactionMonitor.svelte';
  
  let transactions = [];
  let showMonitor = false;
  
  // 监听交换完成事件
  function handleSwapSuccess(txHash) {
    // 添加到交易监控
    transactionMonitor.addTransaction(txHash, "Token Swap");
    showMonitor = true;
  }
</script>

<SwapComponent wallet={userWallet} />
<TransactionMonitor bind:visible={showMonitor} bind:transactions />
```

## 性能优化

### 1. 防抖机制
```javascript
// 防止用户快速输入时频繁调用API
const DEBOUNCE_DELAY = 500; // 500ms延迟

function debounceGetQuote() {
  clearTimeout(quoteTimeout);
  quoteTimeout = setTimeout(getQuote, DEBOUNCE_DELAY);
}
```

### 2. 条件渲染
```svelte
<!-- 只有获得报价后才显示信息 -->
{#if quote}
  <div class="quote-info">
    <!-- 报价详情 -->
  </div>
{/if}

<!-- 只有钱包连接且有报价时才启用按钮 -->
<button disabled={loading || !quote || !wallet}>
  Swap
</button>
```

### 3. 错误边界
```javascript
try {
  // 交换逻辑
} catch (err) {
  // 统一错误处理
  error = handleTransactionError(err);
} finally {
  // 确保状态重置
  loading = false;
}
```

## 样式设计

### 响应式布局
- 桌面端：宽度限制，居中显示
- 移动端：全宽度，触摸友好

### 交互反馈
```css
.switch-btn:hover {
  background: #e9ecef;
  transform: rotate(180deg);
}

.warning {
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  padding: 8px;
  border-radius: 4px;
}
```

## 错误处理

### 常见错误类型
```javascript
function handleTransactionError(error) {
  const errorMessage = error.message || error.toString();
  
  if (errorMessage.includes('InsufficientBalance')) {
    return '余额不足';
  } else if (errorMessage.includes('SlippageTooHigh')) {
    return '滑点过高，请调整参数';
  } else if (errorMessage.includes('PoolPaused')) {
    return '交易对已暂停';
  } else {
    return `交易失败: ${errorMessage}`;
  }
}
```

### 用户反馈
```svelte
{#if error}
  <div class="error">{error}</div>
{/if}

{#if success}
  <div class="success">{success}</div>
{/if}
```

## 扩展功能建议

### 1. 多跳交换
```javascript
// 支持通过多个池子的最优路径交换
const swapRoute = findOptimalRoute(tokenA, tokenB, amount);
```

### 2. 交换历史
```javascript
// 保存用户交换历史
let swapHistory = [];
function addToHistory(swap) {
  swapHistory = [swap, ...swapHistory].slice(0, 50);
}
```

### 3. 预设滑点选项
```svelte
<div class="slippage-presets">
  <button on:click={() => slippageTolerance = 0.1}>0.1%</button>
  <button on:click={() => slippageTolerance = 0.5}>0.5%</button>
  <button on:click={() => slippageTolerance = 1.0}>1.0%</button>
  <input bind:value={slippageTolerance} placeholder="Custom" />
</div>
```

## 注意事项

### ⚠️ 实现限制
- 当前版本使用模拟的coin对象ID
- 生产环境需要实际的代币对象管理
- 需要集成真实的价格预言机

### 🔒 安全考虑
- 所有用户输入都需要验证
- 交易执行前的多重检查
- 滑点保护不可绕过

### 📊 监控需求
- 交换成功率统计
- 平均滑点监控
- 价格影响分析

---

**组件文件**: `SwapComponent.svelte`  
**最后更新**: 2025年8月28日  
**版本**: v1.0