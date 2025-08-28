# TransactionMonitor.svelte - 交易监控组件

## 概述

`TransactionMonitor.svelte` 是 ApexYield AMM 前端应用的交易监控核心组件，提供实时的交易状态追踪和管理功能。它能够监控用户提交的交易，显示交易进度，并提供便捷的区块链浏览器访问功能。

## 主要功能

### 📊 实时交易监控
- 自动轮询检查待确认交易状态
- 支持多个交易同时监控
- 实时更新交易确认状态

### 🗂️ 交易历史管理
- 显示交易历史记录
- 按时间倒序排列
- 支持交易状态筛选

### 🔗 便捷外部链接
- 一键复制交易哈希
- 直接跳转到区块链浏览器
- 支持多种网络（测试网/主网）

### 🧹 智能清理功能
- 清理已完成交易记录
- 一键清空所有历史
- 防止内存泄漏

## API 接口

### Props（输入属性）

```javascript
export let visible = false;    // 监控面板显示/隐藏状态
export let transactions = [];  // 交易数组
```

### 导出函数

```javascript
export { addTransaction }; // 允许父组件添加新交易监控
```

### 依赖服务

```javascript
import { waitForTransactionConfirmation } from '../lib/suiClient.js';
```

## 交易对象结构

```javascript
const transaction = {
  id: Number,           // 唯一标识符（时间戳）
  digest: String,       // 交易哈希
  description: String,  // 交易描述（如"Token Swap: SUI → USDC"）
  status: String,       // 状态：'pending', 'confirmed', 'failed'  
  timestamp: Date,      // 交易提交时间
  confirmations: Number, // 确认数（通常为1）
  error: String|null    // 错误信息（失败时）
};
```

## 核心实现

### 1. 添加交易监控

```javascript
function addTransaction(digest, description) {
  const transaction = {
    id: Date.now(),          // 使用时间戳作为唯一ID
    digest,
    description,
    status: 'pending',       // 初始状态为待确认
    timestamp: new Date(),
    confirmations: 0,
    error: null
  };

  // 添加到数组开头，保持最新交易在顶部
  transactions = [transaction, ...transactions];
  return transaction;
}
```

### 2. 交易状态更新

```javascript
function updateTransactionStatus(id, status, error = null, confirmations = 0) {
  transactions = transactions.map(tx => 
    tx.id === id ? { ...tx, status, error, confirmations } : tx
  );
}

async function monitorTransaction(transaction) {
  try {
    // 调用Sui客户端等待交易确认
    const result = await waitForTransactionConfirmation(transaction.digest);
    
    if (result.confirmed) {
      updateTransactionStatus(transaction.id, 'confirmed', null, 1);
    } else {
      updateTransactionStatus(transaction.id, 'failed', result.error);
    }
  } catch (error) {
    updateTransactionStatus(transaction.id, 'failed', error.message);
  }
}
```

### 3. 自动轮询监控机制

```javascript
onMount(() => {
  // 每3秒检查一次待确认交易
  intervalId = setInterval(() => {
    const pendingTxs = transactions.filter(tx => tx.status === 'pending');
    pendingTxs.forEach(tx => {
      if (tx.status === 'pending') {
        monitorTransaction(tx);
      }
    });
  }, 3000);
});

onDestroy(() => {
  // 组件销毁时清理定时器
  if (intervalId) {
    clearInterval(intervalId);
  }
});
```

### 4. 实用工具函数

```javascript
// 时间格式化
function formatTime(timestamp) {
  return timestamp.toLocaleTimeString();
}

// 交易哈希缩短显示
function formatTxHash(hash) {
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

// 复制到剪贴板
function copyToClipboard(text) {
  navigator.clipboard?.writeText(text);
}

// 在区块链浏览器中查看
function openInExplorer(digest) {
  // Sui测试网浏览器
  const url = `https://suiexplorer.com/txblock/${digest}?network=testnet`;
  window.open(url, '_blank');
}
```

### 5. 历史管理功能

```javascript
// 清理已完成的交易
function clearCompletedTransactions() {
  transactions = transactions.filter(tx => tx.status === 'pending');
}

// 清空所有交易历史
function clearAllTransactions() {
  transactions = [];
}
```

## UI 界面结构

### 1. 监控面板头部

```svelte
<div class="monitor-header">
  <h3>Transaction Monitor</h3>
  <div class="monitor-controls">
    <button 
      on:click={clearCompletedTransactions}
      class="clear-btn"
      disabled={transactions.filter(tx => tx.status !== 'pending').length === 0}
    >
      Clear Completed
    </button>
    <button 
      on:click={clearAllTransactions}
      class="clear-btn danger"
      disabled={transactions.length === 0}
    >
      Clear All
    </button>
    <button on:click={() => visible = false} class="close-btn">×</button>
  </div>
</div>
```

### 2. 交易列表显示

```svelte
<div class="transaction-list">
  {#if transactions.length === 0}
    <div class="empty-state">
      <p>No transactions to monitor</p>
    </div>
  {:else}
    {#each transactions as tx (tx.id)}
      <div class="transaction-item" 
           class:pending={tx.status === 'pending'} 
           class:confirmed={tx.status === 'confirmed'} 
           class:failed={tx.status === 'failed'}>
        
        <!-- 交易状态和时间 -->
        <div class="transaction-header">
          <div class="transaction-status">
            {#if tx.status === 'pending'}
              <div class="status-indicator pending">⏳</div>
              <span class="status-text">Pending</span>
            {:else if tx.status === 'confirmed'}
              <div class="status-indicator confirmed">✅</div>
              <span class="status-text">Confirmed</span>
            {:else if tx.status === 'failed'}
              <div class="status-indicator failed">❌</div>
              <span class="status-text">Failed</span>
            {/if}
          </div>
          <div class="transaction-time">
            {formatTime(tx.timestamp)}
          </div>
        </div>

        <!-- 交易详情 -->
        <div class="transaction-details">
          <div class="transaction-description">
            {tx.description}
          </div>
          
          <!-- 交易哈希 -->
          <div class="transaction-hash">
            <span class="hash-label">Tx Hash:</span>
            <code class="hash-value">{formatTxHash(tx.digest)}</code>
            <button 
              on:click={() => copyToClipboard(tx.digest)}
              class="hash-action"
              title="Copy full hash"
            >
              📋
            </button>
            <button 
              on:click={() => openInExplorer(tx.digest)}
              class="hash-action"
              title="View in explorer"
            >
              🔗
            </button>
          </div>

          <!-- 错误信息显示 -->
          {#if tx.error}
            <div class="transaction-error">
              <strong>Error:</strong> {tx.error}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>
```

### 3. 条件显示逻辑

```svelte
{#if visible}
  <div class="transaction-monitor">
    <!-- 监控面板内容 -->
  </div>
{/if}
```

## 样式设计

### 悬浮面板设计
```css
.transaction-monitor {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 400px;
  max-height: 600px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 1000;
}
```

### 状态颜色系统
```css
.transaction-item.pending {
  border-left-color: #ed8936;  /* 橙色 */
  background: #fffaf0;
}

.transaction-item.confirmed {
  border-left-color: #48bb78;  /* 绿色 */
  background: #f0fff4;
}

.transaction-item.failed {
  border-left-color: #e53e3e;  /* 红色 */
  background: #fed7d7;
}
```

### 响应式设计
```css
@media (max-width: 768px) {
  .transaction-monitor {
    top: 10px;
    right: 10px;
    left: 10px;
    width: auto;
    max-height: 400px;
  }
}
```

## 集成使用

### 1. 父组件集成

```svelte
<script>
  import TransactionMonitor from './components/TransactionMonitor.svelte';
  import SwapComponent from './components/SwapComponent.svelte';
  
  let showMonitor = false;
  let transactions = [];
  let transactionMonitor; // 组件引用
  
  async function handleSwap() {
    try {
      // 执行交换交易
      const result = await performSwapTransaction();
      
      if (result.digest) {
        // 添加到交易监控
        transactionMonitor.addTransaction(
          result.digest, 
          `Token Swap: ${amount} SUI → USDC`
        );
        showMonitor = true;
      }
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  }
</script>

<SwapComponent on:swapExecuted={handleSwap} />

<TransactionMonitor 
  bind:this={transactionMonitor}
  bind:visible={showMonitor}
  bind:transactions={transactions}
/>
```

### 2. 自动显示控制

```javascript
// 当有待确认交易时自动显示监控面板
$: if (transactions.some(tx => tx.status === 'pending')) {
  visible = true;
}

// 当所有交易完成时可以选择自动隐藏
$: if (transactions.length > 0 && 
       !transactions.some(tx => tx.status === 'pending')) {
  // 可以选择延迟隐藏或保持显示
  setTimeout(() => {
    if (!transactions.some(tx => tx.status === 'pending')) {
      visible = false;
    }
  }, 5000);
}
```

### 3. 与其他组件协调

```svelte
<script>
  let transactionMonitor;
  
  // 统一的交易提交处理函数
  function handleTransactionSubmit(digest, description) {
    transactionMonitor.addTransaction(digest, description);
    showTransactionMonitor = true;
  }
</script>

<!-- 传递处理函数给各个交易组件 -->
<SwapComponent onTransaction={handleTransactionSubmit} />
<LiquidityComponent onTransaction={handleTransactionSubmit} />

<TransactionMonitor bind:this={transactionMonitor} />
```

## 性能优化

### 1. 轮询优化

```javascript
// 只监控待确认的交易，避免无效API调用
const pendingTxs = transactions.filter(tx => tx.status === 'pending');
if (pendingTxs.length === 0) {
  // 没有待确认交易时停止轮询
  clearInterval(intervalId);
  intervalId = null;
}
```

### 2. 内存管理

```javascript
// 自动清理机制防止内存泄漏
const MAX_TRANSACTIONS = 50;

function autoCleanup() {
  if (transactions.length > MAX_TRANSACTIONS) {
    // 保留最新的50个交易
    transactions = transactions.slice(0, MAX_TRANSACTIONS);
  }
}

// 定期清理
setInterval(autoCleanup, 60000); // 每分钟清理一次
```

### 3. 状态更新优化

```javascript
// 批量状态更新
function batchUpdateTransactions(updates) {
  transactions = transactions.map(tx => {
    const update = updates.find(u => u.id === tx.id);
    return update ? { ...tx, ...update } : tx;
  });
}
```

## 错误处理

### 网络错误处理

```javascript
async function monitorTransaction(transaction) {
  try {
    const result = await waitForTransactionConfirmation(
      transaction.digest, 
      30000 // 30秒超时
    );
    // ... 处理结果
  } catch (error) {
    if (error.message.includes('timeout')) {
      // 超时错误，可以重试
      updateTransactionStatus(
        transaction.id, 
        'failed', 
        'Transaction confirmation timeout'
      );
    } else {
      // 其他网络错误
      updateTransactionStatus(
        transaction.id, 
        'failed', 
        error.message
      );
    }
  }
}
```

### 状态恢复

```javascript
// 页面刷新后恢复监控状态
onMount(() => {
  const savedTransactions = localStorage.getItem('pending_transactions');
  if (savedTransactions) {
    try {
      const parsed = JSON.parse(savedTransactions);
      transactions = parsed.map(tx => ({
        ...tx,
        timestamp: new Date(tx.timestamp)
      }));
    } catch (err) {
      console.error('Failed to restore transactions:', err);
    }
  }
});

// 保存待确认交易到本地存储
$: {
  const pendingTx = transactions.filter(tx => tx.status === 'pending');
  localStorage.setItem('pending_transactions', JSON.stringify(pendingTx));
}
```

## 扩展功能建议

### 1. 多网络支持

```javascript
function openInExplorer(digest, network = 'testnet') {
  const explorers = {
    testnet: `https://suiexplorer.com/txblock/${digest}?network=testnet`,
    mainnet: `https://suiexplorer.com/txblock/${digest}?network=mainnet`,
    devnet: `https://suiexplorer.com/txblock/${digest}?network=devnet`
  };
  
  window.open(explorers[network], '_blank');
}
```

### 2. 交易分类

```javascript
const transactionTypes = {
  swap: { icon: '🔄', color: '#667eea' },
  addLiquidity: { icon: '➕', color: '#48bb78' },
  removeLiquidity: { icon: '➖', color: '#e53e3e' },
  claim: { icon: '💰', color: '#ed8936' }
};
```

### 3. 通知系统

```javascript
// 浏览器通知
function showNotification(title, message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico'
    });
  }
}

// 交易确认后显示通知
if (result.confirmed) {
  showNotification(
    'Transaction Confirmed',
    `Your ${transaction.description} has been confirmed`
  );
}
```

### 4. 导出功能

```javascript
function exportTransactionHistory() {
  const csv = transactions.map(tx => 
    `${tx.timestamp.toISOString()},${tx.description},${tx.status},${tx.digest}`
  ).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transaction_history.csv';
  a.click();
}
```

## 注意事项

### ⚠️ 轮询频率
- 当前设置为3秒轮询，可根据网络情况调整
- 考虑实现退避算法减少服务器压力

### 🔒 隐私保护
- 交易哈希是公开信息，可以安全显示
- 不要在描述中包含敏感的用户信息

### 📱 移动端优化
- 监控面板在小屏设备上全屏显示
- 触摸友好的按钮尺寸

### 🚀 性能考虑
- 限制最大交易数量防止内存泄漏
- 使用虚拟滚动优化长列表渲染

---

**组件文件**: `TransactionMonitor.svelte`  
**最后更新**: 2025年8月28日  
**版本**: v1.0