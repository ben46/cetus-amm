# WalletConnection.svelte - 钱包连接组件

## 概述

`WalletConnection.svelte` 是 ApexYield AMM 前端应用的核心钱包管理组件，负责处理用户钱包的连接、断开连接，以及显示用户的地址和代币余额信息。

## 主要功能

### 🔗 钱包连接管理
- 模拟钱包连接（演示版本使用生成的密钥对）
- 支持连接状态的实时显示
- 提供连接和断开连接功能

### 💰 余额管理
- 加载并显示用户所有代币余额
- 支持余额手动刷新
- 格式化显示余额数值

### 📢 事件通信
- 向父组件发送钱包连接/断开连接事件
- 实现组件间的状态同步

## API 接口

### Props（输入属性）

```javascript
export let wallet = null; // 钱包对象，包含地址和签名器
```

### Events（事件）

```javascript
// 钱包连接成功事件
dispatch('walletConnected', wallet);

// 钱包断开连接事件
dispatch('walletDisconnected');
```

### 钱包对象结构

```javascript
const wallet = {
  address: String,        // Sui地址 (0x...)
  signer: Ed25519Keypair, // 签名器对象
  connected: Boolean,     // 连接状态
  provider: String        // 钱包提供商名称
};
```

## 核心实现

### 1. 钱包连接逻辑

```javascript
async function connectWallet() {
  connecting = true;
  error = '';

  try {
    // 演示版本：生成新的密钥对
    const keypair = Ed25519Keypair.generate();
    const address = keypair.getPublicKey().toSuiAddress();

    const newWallet = {
      address,
      signer: keypair,
      connected: true,
      provider: 'Demo Wallet'
    };

    wallet = newWallet;
    dispatch('walletConnected', wallet);
    await loadUserBalances();

  } catch (err) {
    error = `Failed to connect wallet: ${err.message}`;
  } finally {
    connecting = false;
  }
}
```

### 2. 余额加载功能

```javascript
async function loadUserBalances() {
  if (!wallet) return;

  try {
    // 并行加载所有代币类型的余额
    const balancePromises = Object.entries(COMMON_COIN_TYPES).map(
      async ([symbol, coinType]) => {
        try {
          const balance = await getUserBalance(wallet.address, coinType);
          return [symbol, balance.totalBalance];
        } catch (err) {
          console.error(`Failed to load ${symbol} balance:`, err);
          return [symbol, 0]; // 失败时返回0余额
        }
      }
    );

    const balances = await Promise.all(balancePromises);
    userBalances = Object.fromEntries(balances);
  } catch (err) {
    console.error('Failed to load balances:', err);
  }
}
```

### 3. 地址格式化

```javascript
function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(balance) {
  return (balance / 1e9).toFixed(6);
}
```

## 内部状态

```javascript
let connecting = false;     // 连接进行中状态
let error = '';            // 错误信息
let userBalances = {};     // 用户余额映射 {SUI: 1000000000, USDC: 500000000}
```

## 使用示例

### 基本使用

```svelte
<script>
  import WalletConnection from './components/WalletConnection.svelte';
  
  let currentWallet = null;
  
  function handleWalletConnected(event) {
    currentWallet = event.detail;
    console.log('钱包已连接:', currentWallet.address);
    // 可以在这里触发其他组件的初始化
  }
  
  function handleWalletDisconnected() {
    currentWallet = null;
    console.log('钱包已断开');
    // 清理其他组件状态
  }
</script>

<WalletConnection 
  bind:wallet={currentWallet}
  on:walletConnected={handleWalletConnected}
  on:walletDisconnected={handleWalletDisconnected}
/>
```

### 与其他组件集成

```svelte
<script>
  import WalletConnection from './components/WalletConnection.svelte';
  import SwapComponent from './components/SwapComponent.svelte';
  
  let wallet = null;
</script>

<!-- 钱包连接组件 -->
<WalletConnection bind:wallet />

<!-- 只有钱包连接后才显示交换组件 -->
{#if wallet && wallet.connected}
  <SwapComponent {wallet} />
{/if}
```

## UI 界面结构

### 连接前界面
```svelte
<div class="connect-section">
  <h3>Connect Wallet</h3>
  <p>Connect your wallet to start trading on ApexYield AMM</p>
  
  {#if error}
    <div class="error">{error}</div>
  {/if}

  <button 
    on:click={connectWallet}
    disabled={connecting}
    class="primary-button connect-btn"
  >
    {connecting ? 'Connecting...' : 'Connect Demo Wallet'}
  </button>
</div>
```

### 连接后界面
```svelte
<div class="wallet-info">
  <div class="wallet-header">
    <div class="wallet-status">
      <div class="status-indicator connected"></div>
      <span class="provider-name">{wallet.provider}</span>
    </div>
    <button on:click={disconnectWallet} class="disconnect-btn">
      Disconnect
    </button>
  </div>
  
  <!-- 地址显示 -->
  <div class="address-section">
    <label>Address:</label>
    <code class="address">{formatAddress(wallet.address)}</code>
    <button on:click={() => navigator.clipboard?.writeText(wallet.address)}>
      📋
    </button>
  </div>

  <!-- 余额显示 -->
  <div class="balances-section">
    <h4>Balances</h4>
    <div class="balances-grid">
      {#each Object.entries(userBalances) as [symbol, balance]}
        <div class="balance-item">
          <span class="token-symbol">{symbol}</span>
          <span class="token-balance">{formatBalance(balance)}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
```

## 样式特性

### 响应式设计
- 桌面端：横向布局，信息完整显示
- 移动端：纵向布局，简化显示

### 状态指示
- 绿色圆点：表示钱包已连接
- 按钮状态：连接中时显示"Connecting..."
- 错误提示：红色背景显示错误信息

### 交互反馈
- 地址复制：点击复制按钮后的视觉反馈
- 按钮悬停：颜色变化和阴影效果
- 加载状态：防止重复点击

## 错误处理

### 连接错误
```javascript
try {
  // 钱包连接逻辑
} catch (err) {
  error = `Failed to connect wallet: ${err.message}`;
  console.error('Wallet connection error:', err);
}
```

### 余额加载错误
- 单个代币余额加载失败：返回0，不影响其他代币
- 整体余额加载失败：控制台记录错误，用户界面显示空余额

## 集成依赖

### 导入模块
```javascript
import { createEventDispatcher } from 'svelte';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { getUserBalance } from '../lib/queries.js';
import { COMMON_COIN_TYPES } from '../lib/config.js';
```

### 配置依赖
- `COMMON_COIN_TYPES`: 支持的代币类型配置
- `getUserBalance()`: 查询用户余额的服务函数

## 注意事项

### ⚠️ 演示版本限制
当前版本使用随机生成的密钥对模拟钱包连接，生产环境需要集成真实的钱包提供商：

```javascript
// 生产环境应该替换为：
// - @mysten/wallet-kit
// - Sui Wallet
// - Suiet Wallet  
// - Ethos Wallet
```

### 🔒 安全考虑
- 私钥仅在客户端生成和使用
- 不将敏感信息传输到服务器
- 钱包断开连接时清理所有状态

### 🎯 性能优化
- 余额加载使用并行请求
- 防抖处理避免频繁请求
- 响应式数据更新减少DOM操作

## 扩展建议

### 多钱包支持
```javascript
const walletProviders = [
  { name: 'Sui Wallet', connect: connectSuiWallet },
  { name: 'Suiet Wallet', connect: connectSuietWallet },
  { name: 'Ethos Wallet', connect: connectEthosWallet }
];
```

### 自动重连
```javascript
// 页面刷新后尝试恢复钱包连接
onMount(() => {
  const savedWallet = localStorage.getItem('connected_wallet');
  if (savedWallet) {
    // 尝试重新连接
  }
});
```

### 网络切换
```javascript
// 支持不同Sui网络切换
let selectedNetwork = 'testnet'; // 'mainnet', 'devnet', 'testnet'
```

---

**组件文件**: `WalletConnection.svelte`  
**最后更新**: 2025年8月28日  
**版本**: v1.0