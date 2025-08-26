<script>
  import { onMount, onDestroy } from 'svelte';
  import { waitForTransactionConfirmation } from '../lib/suiClient.js';

  export let visible = false;
  export let transactions = [];

  let intervalId;

  // Transaction status can be: 'pending', 'confirmed', 'failed'
  function addTransaction(digest, description) {
    const transaction = {
      id: Date.now(),
      digest,
      description,
      status: 'pending',
      timestamp: new Date(),
      confirmations: 0,
      error: null
    };

    transactions = [transaction, ...transactions];
    return transaction;
  }

  function updateTransactionStatus(id, status, error = null, confirmations = 0) {
    transactions = transactions.map(tx => 
      tx.id === id ? { ...tx, status, error, confirmations } : tx
    );
  }

  async function monitorTransaction(transaction) {
    try {
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

  function formatTime(timestamp) {
    return timestamp.toLocaleTimeString();
  }

  function formatTxHash(hash) {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  }

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text);
  }

  function openInExplorer(digest) {
    // Sui testnet explorer
    const url = `https://suiexplorer.com/txblock/${digest}?network=testnet`;
    window.open(url, '_blank');
  }

  function clearCompletedTransactions() {
    transactions = transactions.filter(tx => tx.status === 'pending');
  }

  function clearAllTransactions() {
    transactions = [];
  }

  // Start monitoring pending transactions
  onMount(() => {
    intervalId = setInterval(() => {
      const pendingTxs = transactions.filter(tx => tx.status === 'pending');
      pendingTxs.forEach(tx => {
        if (tx.status === 'pending') {
          monitorTransaction(tx);
        }
      });
    }, 3000); // Check every 3 seconds
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Expose functions to parent component
  export { addTransaction };
</script>

{#if visible}
  <div class="transaction-monitor">
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

    <div class="transaction-list">
      {#if transactions.length === 0}
        <div class="empty-state">
          <p>No transactions to monitor</p>
        </div>
      {:else}
        {#each transactions as tx (tx.id)}
          <div class="transaction-item" class:pending={tx.status === 'pending'} class:confirmed={tx.status === 'confirmed'} class:failed={tx.status === 'failed'}>
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

            <div class="transaction-details">
              <div class="transaction-description">
                {tx.description}
              </div>
              
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
  </div>
{/if}

<style>
  .transaction-monitor {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    max-height: 600px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    border: 1px solid #e1e5e9;
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .monitor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e1e5e9;
  }

  .monitor-header h3 {
    margin: 0;
    color: #2d3748;
    font-size: 18px;
  }

  .monitor-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .clear-btn {
    background: #718096;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .clear-btn:hover:not(:disabled) {
    background: #4a5568;
  }

  .clear-btn:disabled {
    background: #e2e8f0;
    color: #a0aec0;
    cursor: not-allowed;
  }

  .clear-btn.danger {
    background: #e53e3e;
  }

  .clear-btn.danger:hover:not(:disabled) {
    background: #c53030;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #718096;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .close-btn:hover {
    background: #e2e8f0;
  }

  .transaction-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #718096;
  }

  .transaction-item {
    background: #f7fafc;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    border-left: 4px solid #e2e8f0;
    transition: all 0.2s ease;
  }

  .transaction-item.pending {
    border-left-color: #ed8936;
    background: #fffaf0;
  }

  .transaction-item.confirmed {
    border-left-color: #48bb78;
    background: #f0fff4;
  }

  .transaction-item.failed {
    border-left-color: #e53e3e;
    background: #fed7d7;
  }

  .transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .transaction-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    font-size: 16px;
  }

  .status-text {
    font-weight: 600;
    font-size: 14px;
  }

  .transaction-item.pending .status-text {
    color: #c05621;
  }

  .transaction-item.confirmed .status-text {
    color: #276749;
  }

  .transaction-item.failed .status-text {
    color: #c53030;
  }

  .transaction-time {
    font-size: 12px;
    color: #718096;
  }

  .transaction-description {
    font-weight: 500;
    color: #2d3748;
    margin-bottom: 8px;
  }

  .transaction-hash {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .hash-label {
    color: #718096;
  }

  .hash-value {
    background: rgba(255, 255, 255, 0.8);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
    color: #4a5568;
  }

  .hash-action {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 3px;
    transition: background 0.2s ease;
  }

  .hash-action:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .transaction-error {
    margin-top: 8px;
    padding: 8px;
    background: rgba(254, 215, 215, 0.5);
    border-radius: 4px;
    font-size: 12px;
    color: #c53030;
  }

  @media (max-width: 768px) {
    .transaction-monitor {
      top: 10px;
      right: 10px;
      left: 10px;
      width: auto;
      max-height: 400px;
    }

    .monitor-header {
      padding: 16px;
    }

    .monitor-header h3 {
      font-size: 16px;
    }

    .monitor-controls {
      gap: 6px;
    }

    .clear-btn {
      padding: 4px 8px;
      font-size: 11px;
    }
  }
</style>