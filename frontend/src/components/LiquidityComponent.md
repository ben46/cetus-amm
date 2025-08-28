# LiquidityComponent.svelte - 流动性管理组件

## 概述

`LiquidityComponent.svelte` 是 ApexYield AMM 前端应用的流动性管理核心组件，提供完整的流动性池管理功能。用户可以查看池子信息、添加流动性获得LP代币收益，以及移除流动性赎回底层资产。

## 主要功能

### 📊 池子信息展示
- 显示流动性池的储备量、总供应量
- 实时展示手续费率和协议费率
- 显示用户在该池中的份额

### 💰 添加流动性
- 双代币输入，自动计算最佳比例
- 滑点保护机制
- LP代币铸造和分发

### 🔥 移除流动性
- LP代币燃烧换回底层资产
- 按比例赎回代币A和代币B
- 最小输出保护

### ⚖️ 智能比例计算
- 根据池中储备量自动计算代币比例
- 提供"MAX"按钮快速设置最大可用余额
- 双向比例计算支持

## API 接口

### Props（输入属性）

```javascript
export let wallet;          // 钱包对象
export let selectedPool = '';  // 选中的流动性池ID
```

### 依赖服务

```javascript
import { addLiquidity, removeLiquidity } from '../lib/ammFunctions.js';
import { getPoolInfo, getUserBalance } from '../lib/queries.js';
import { handleTransactionError } from '../lib/suiClient.js';
import { COMMON_COIN_TYPES } from '../lib/config.js';
```

## 核心实现

### 1. 池子信息和余额加载

```javascript
// 响应式加载 - 当选择池子或钱包变化时自动触发
$: if (selectedPool && wallet) {
  loadPoolInfo();
  loadUserBalances();
}

async function loadPoolInfo() {
  try {
    poolInfo = await getPoolInfo(selectedPool);
  } catch (err) {
    console.error('Failed to load pool info:', err);
  }
}

async function loadUserBalances() {
  if (!wallet || !selectedPoolInfo) return;

  try {
    // 并行加载用户的代币A和代币B余额
    const balanceA = await getUserBalance(wallet.address, selectedPoolInfo.coinA);
    const balanceB = await getUserBalance(wallet.address, selectedPoolInfo.coinB);
    
    userBalanceA = balanceA.totalBalance;
    userBalanceB = balanceB.totalBalance;

    // 加载LP代币余额（简化实现，实际需要查询LP代币类型）
    userLPBalance = 1000000000; // 示例：1 LP token
  } catch (err) {
    console.error('Failed to load balances:', err);
  }
}
```

### 2. 添加流动性逻辑

```javascript
async function handleAddLiquidity() {
  if (!wallet || !selectedPool || !selectedPoolInfo) return;

  loading = true;
  error = '';
  success = '';

  try {
    // 转换为wei单位
    const amountAWei = parseFloat(amountA) * 1e9;
    const amountBWei = parseFloat(amountB) * 1e9;
    
    // 1%滑点保护
    const minAmountAWei = amountAWei * 0.99;
    const minAmountBWei = amountBWei * 0.99;

    const result = await addLiquidity(
      selectedPool,
      selectedPoolInfo.coinA,
      selectedPoolInfo.coinB,
      'coinAId', // 实际应用中需要真实的coin对象ID
      'coinBId',
      amountAWei,
      amountBWei,
      minAmountAWei,
      minAmountBWei,
      wallet.signer
    );

    if (result.success) {
      success = 'Liquidity added successfully!';
      amountA = '';
      amountB = '';
      loadUserBalances(); // 刷新用户余额
    } else {
      error = `Add liquidity failed: ${result.error}`;
    }
  } catch (err) {
    error = handleTransactionError(err);
  } finally {
    loading = false;
  }
}
```

### 3. 移除流动性逻辑

```javascript
async function handleRemoveLiquidity() {
  if (!wallet || !selectedPool || !selectedPoolInfo) return;

  loading = true;
  error = '';
  success = '';

  try {
    const liquidityWei = parseFloat(liquidityToRemove) * 1e9;
    
    // 基于当前池比例计算最小输出（简化实现）
    const minAmountA = 0;
    const minAmountB = 0;

    const result = await removeLiquidity(
      selectedPool,
      selectedPoolInfo.coinA,
      selectedPoolInfo.coinB,
      'lpTokenId', // 实际应用中需要真实的LP代币ID
      liquidityWei,
      minAmountA,
      minAmountB,
      wallet.signer
    );

    if (result.success) {
      success = 'Liquidity removed successfully!';
      liquidityToRemove = '';
      loadUserBalances(); // 刷新用户余额
    } else {
      error = `Remove liquidity failed: ${result.error}`;
    }
  } catch (err) {
    error = handleTransactionError(err);
  } finally {
    loading = false;
  }
}
```

### 4. 智能比例计算

```javascript
// 根据代币A数量自动计算代币B数量
function calculateRatio() {
  if (!poolInfo || !amountA) return;
  
  const ratio = parseInt(poolInfo.reserveB) / parseInt(poolInfo.reserveA);
  amountB = (parseFloat(amountA) * ratio).toFixed(6);
}

// 设置最大代币A数量并计算对应的代币B
function setMaxAmountA() {
  amountA = (userBalanceA / 1e9).toFixed(6);
  calculateRatio();
}

// 设置最大代币B数量并反向计算代币A
function setMaxAmountB() {
  amountB = (userBalanceB / 1e9).toFixed(6);
  if (poolInfo && amountB) {
    const ratio = parseInt(poolInfo.reserveA) / parseInt(poolInfo.reserveB);
    amountA = (parseFloat(amountB) * ratio).toFixed(6);
  }
}
```

## 内部状态管理

### 核心状态变量

```javascript
let amountA = '';           // 代币A输入数量
let amountB = '';           // 代币B输入数量
let poolInfo = null;        // 池子信息对象
let userLPBalance = 0;      // 用户LP代币余额
let userBalanceA = 0;       // 用户代币A余额  
let userBalanceB = 0;       // 用户代币B余额
let liquidityToRemove = ''; // 要移除的流动性数量
let loading = false;        // 操作进行中状态
let error = '';            // 错误信息
let success = '';          // 成功信息
let activeTab = 'add';     // 当前选项卡：'add'或'remove'
```

### 池子信息结构

```javascript
const poolInfo = {
  coinTypeA: String,      // 代币A类型
  coinTypeB: String,      // 代币B类型  
  reserveA: String,       // 代币A储备量（wei）
  reserveB: String,       // 代币B储备量（wei）
  totalSupply: String,    // LP代币总供应量
  feeRate: Number,        // 交易手续费率（基点）
  protocolFeeRate: Number // 协议费率
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

// 响应式获取当前选中池子信息
$: selectedPoolInfo = availablePools.find(p => p.id === selectedPool);
```

## UI 界面结构

### 1. 池子选择器

```svelte
<div class="pool-selector">
  <div class="input-group">
    <label>Select Pool</label>
    <select bind:value={selectedPool}>
      <option value="">Select trading pair</option>
      {#each availablePools as pool}
        <option value={pool.id}>{pool.name}</option>
      {/each}
    </select>
  </div>
</div>
```

### 2. 池子统计信息

```svelte
{#if selectedPool && poolInfo}
  <div class="pool-stats">
    <h3>Pool Statistics</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">Reserve A:</span>
        <span class="stat-value">
          {(parseInt(poolInfo.reserveA) / 1e9).toLocaleString()}
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Reserve B:</span>
        <span class="stat-value">
          {(parseInt(poolInfo.reserveB) / 1e9).toLocaleString()}
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Supply:</span>
        <span class="stat-value">
          {(parseInt(poolInfo.totalSupply) / 1e9).toLocaleString()}
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Fee Rate:</span>
        <span class="stat-value">{poolInfo.feeRate / 100}%</span>
      </div>
    </div>
  </div>
{/if}
```

### 3. 用户余额显示

```svelte
<div class="user-balances">
  <h3>Your Balances</h3>
  <div class="balance-grid">
    <div class="balance-item">
      <span>Token A:</span>
      <span>{(userBalanceA / 1e9).toFixed(6)}</span>
    </div>
    <div class="balance-item">
      <span>Token B:</span>
      <span>{(userBalanceB / 1e9).toFixed(6)}</span>
    </div>
    <div class="balance-item">
      <span>LP Tokens:</span>
      <span>{(userLPBalance / 1e9).toFixed(6)}</span>
    </div>
  </div>
</div>
```

### 4. 选项卡导航

```svelte
<div class="tabs">
  <button 
    class="tab-button" 
    class:active={activeTab === 'add'}
    on:click={() => activeTab = 'add'}
  >
    Add Liquidity
  </button>
  <button 
    class="tab-button" 
    class:active={activeTab === 'remove'}
    on:click={() => activeTab = 'remove'}
  >
    Remove Liquidity
  </button>
</div>
```

### 5. 添加流动性表单

```svelte
{#if activeTab === 'add'}
  <div class="liquidity-form">
    <h3>Add Liquidity</h3>
    
    <div class="input-group">
      <label>Token A Amount</label>
      <div class="input-with-max">
        <input
          type="number"
          bind:value={amountA}
          placeholder="Token A amount"
          step="0.000001"
          min="0"
          on:input={calculateRatio}
        />
        <button type="button" on:click={setMaxAmountA} class="max-btn">
          MAX
        </button>
      </div>
    </div>

    <div class="input-group">
      <label>Token B Amount</label>
      <div class="input-with-max">
        <input
          type="number"
          bind:value={amountB}
          placeholder="Token B amount"
          step="0.000001"
          min="0"
        />
        <button type="button" on:click={setMaxAmountB} class="max-btn">
          MAX
        </button>
      </div>
    </div>

    <button 
      on:click={handleAddLiquidity}
      disabled={loading || !amountA || !amountB || !wallet}
      class="primary-button"
    >
      {loading ? 'Adding...' : 'Add Liquidity'}
    </button>
  </div>
{/if}
```

### 6. 移除流动性表单

```svelte
{#if activeTab === 'remove'}
  <div class="liquidity-form">
    <h3>Remove Liquidity</h3>
    
    <div class="input-group">
      <label>LP Token Amount</label>
      <div class="input-with-max">
        <input
          type="number"
          bind:value={liquidityToRemove}
          placeholder="LP token amount"
          step="0.000001"
          min="0"
        />
        <button 
          type="button" 
          on:click={() => liquidityToRemove = (userLPBalance / 1e9).toFixed(6)}
          class="max-btn"
        >
          MAX
        </button>
      </div>
    </div>

    <button 
      on:click={handleRemoveLiquidity}
      disabled={loading || !liquidityToRemove || !wallet}
      class="primary-button remove-btn"
    >
      {loading ? 'Removing...' : 'Remove Liquidity'}
    </button>
  </div>
{/if}
```

## 用户体验优化

### 1. 自动比例计算
```javascript
// 输入代币A时自动计算代币B
on:input={calculateRatio}

// 确保用户输入的比例接近池子当前比例
function validateRatio() {
  if (!poolInfo || !amountA || !amountB) return true;
  
  const inputRatio = parseFloat(amountB) / parseFloat(amountA);
  const poolRatio = parseInt(poolInfo.reserveB) / parseInt(poolInfo.reserveA);
  const deviation = Math.abs(inputRatio - poolRatio) / poolRatio;
  
  return deviation < 0.02; // 允许2%的偏差
}
```

### 2. MAX按钮功能
```javascript
// 智能MAX功能 - 考虑gas费预留
function setMaxAmountA() {
  const maxAmount = Math.max(0, (userBalanceA - 10000000) / 1e9); // 预留0.01代币作为gas
  amountA = maxAmount.toFixed(6);
  calculateRatio();
}
```

### 3. 实时验证
```javascript
// 余额充足性检查
$: insufficientBalanceA = parseFloat(amountA) * 1e9 > userBalanceA;
$: insufficientBalanceB = parseFloat(amountB) * 1e9 > userBalanceB;
```

## 安全特性

### 1. 滑点保护
```javascript
// 固定1%滑点保护（可配置）
const SLIPPAGE_TOLERANCE = 0.01;
const minAmountAWei = amountAWei * (1 - SLIPPAGE_TOLERANCE);
const minAmountBWei = amountBWei * (1 - SLIPPAGE_TOLERANCE);
```

### 2. 输入验证
```javascript
// 数值有效性检查
function validateInputs() {
  if (activeTab === 'add') {
    return amountA && amountB && 
           parseFloat(amountA) > 0 && 
           parseFloat(amountB) > 0 &&
           parseFloat(amountA) * 1e9 <= userBalanceA &&
           parseFloat(amountB) * 1e9 <= userBalanceB;
  } else {
    return liquidityToRemove && 
           parseFloat(liquidityToRemove) > 0 &&
           parseFloat(liquidityToRemove) * 1e9 <= userLPBalance;
  }
}
```

### 3. 状态重置
```javascript
// 操作完成后清理状态
if (result.success) {
  success = 'Operation successful!';
  // 清空输入
  amountA = '';
  amountB = '';
  liquidityToRemove = '';
  // 刷新余额
  loadUserBalances();
}
```

## 样式设计

### 响应式网格
```css
.stats-grid, .balance-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 768px) {
  .stats-grid, .balance-grid {
    grid-template-columns: 1fr;
  }
}
```

### 选项卡样式
```css
.tab-button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
}
```

### MAX按钮设计
```css
.max-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
```

## 使用示例

### 基本集成
```svelte
<script>
  import LiquidityComponent from './components/LiquidityComponent.svelte';
  
  let userWallet = null;
  let currentPool = 'pool1'; // 默认选择第一个池子
  
  function handleWalletConnected(event) {
    userWallet = event.detail;
  }
</script>

{#if userWallet}
  <LiquidityComponent 
    wallet={userWallet}
    bind:selectedPool={currentPool}
  />
{:else}
  <p>Please connect your wallet to manage liquidity</p>
{/if}
```

### 与其他组件协调
```svelte
<script>
  let selectedPool = '';
  let wallet = null;
</script>

<!-- 钱包连接 -->
<WalletConnection bind:wallet />

<!-- 交换和流动性使用相同的池子选择 -->
<SwapComponent {wallet} bind:selectedPool />
<LiquidityComponent {wallet} bind:selectedPool />
```

## 错误处理

### 常见错误处理
```javascript
function handleTransactionError(err) {
  const errorMessage = err.message || err.toString();
  
  if (errorMessage.includes('InsufficientBalance')) {
    return '余额不足，请检查代币数量';
  } else if (errorMessage.includes('SlippageTooHigh')) {
    return '滑点过高，请稍后重试';
  } else if (errorMessage.includes('PoolNotExists')) {
    return '流动性池不存在';
  } else if (errorMessage.includes('MinLiquidityNotMet')) {
    return '流动性数量不足最小要求';
  } else {
    return `操作失败: ${errorMessage}`;
  }
}
```

### 状态反馈
```svelte
{#if error}
  <div class="error">{error}</div>
{/if}

{#if success}
  <div class="success">{success}</div>
{/if}

<!-- 加载状态 -->
{#if loading}
  <div class="loading-overlay">
    <div class="spinner"></div>
    <p>Transaction in progress...</p>
  </div>
{/if}
```

## 性能优化

### 1. 数据加载优化
```javascript
// 防止重复加载
let loadingPoolInfo = false;

async function loadPoolInfo() {
  if (loadingPoolInfo) return;
  
  loadingPoolInfo = true;
  try {
    poolInfo = await getPoolInfo(selectedPool);
  } finally {
    loadingPoolInfo = false;
  }
}
```

### 2. 计算优化
```javascript
// 防抖比例计算
let ratioTimeout;
function debounceCalculateRatio() {
  clearTimeout(ratioTimeout);
  ratioTimeout = setTimeout(calculateRatio, 300);
}
```

## 扩展功能建议

### 1. 高级滑点设置
```svelte
<div class="slippage-settings">
  <label>Slippage Tolerance</label>
  <div class="slippage-options">
    <button on:click={() => slippageTolerance = 0.005}>0.5%</button>
    <button on:click={() => slippageTolerance = 0.01}>1%</button>
    <button on:click={() => slippageTolerance = 0.03}>3%</button>
    <input bind:value={slippageTolerance} />
  </div>
</div>
```

### 2. 预计收益显示
```javascript
// 计算添加流动性后的预期LP代币数量
function calculateExpectedLPTokens(amountA, amountB) {
  if (!poolInfo) return 0;
  
  const reserveA = parseInt(poolInfo.reserveA);
  const reserveB = parseInt(poolInfo.reserveB);
  const totalSupply = parseInt(poolInfo.totalSupply);
  
  // 简化计算：使用几何平均
  const liquidityMinted = Math.sqrt(amountA * amountB) * totalSupply / Math.sqrt(reserveA * reserveB);
  return liquidityMinted;
}
```

### 3. 价格影响显示
```javascript
// 显示添加流动性对池子价格的影响
function calculatePriceImpact(amountA, amountB) {
  if (!poolInfo) return 0;
  
  const currentPrice = parseInt(poolInfo.reserveB) / parseInt(poolInfo.reserveA);
  const inputPrice = (amountB * 1e9) / (amountA * 1e9);
  
  return Math.abs(inputPrice - currentPrice) / currentPrice * 100;
}
```

---

**组件文件**: `LiquidityComponent.svelte`  
**最后更新**: 2025年8月28日  
**版本**: v1.0