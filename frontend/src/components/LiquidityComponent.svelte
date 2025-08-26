<script>
  import { onMount } from 'svelte';
  import { addLiquidity, removeLiquidity } from '../lib/ammFunctions.js';
  import { getPoolInfo, getUserBalance } from '../lib/queries.js';
  import { handleTransactionError } from '../lib/suiClient.js';
  import { COMMON_COIN_TYPES } from '../lib/config.js';

  export let wallet;
  export let selectedPool = '';

  let amountA = '';
  let amountB = '';
  let poolInfo = null;
  let userLPBalance = 0;
  let userBalanceA = 0;
  let userBalanceB = 0;
  let liquidityToRemove = '';
  let loading = false;
  let error = '';
  let success = '';
  let activeTab = 'add'; // 'add' or 'remove'

  // Available pools
  let availablePools = [
    { id: 'pool1', name: 'SUI/USDC', coinA: COMMON_COIN_TYPES.SUI, coinB: COMMON_COIN_TYPES.USDC },
    { id: 'pool2', name: 'USDC/USDT', coinA: COMMON_COIN_TYPES.USDC, coinB: COMMON_COIN_TYPES.USDT }
  ];

  $: selectedPoolInfo = availablePools.find(p => p.id === selectedPool);

  // Load pool info when selected pool changes
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
      const balanceA = await getUserBalance(wallet.address, selectedPoolInfo.coinA);
      const balanceB = await getUserBalance(wallet.address, selectedPoolInfo.coinB);
      
      userBalanceA = balanceA.totalBalance;
      userBalanceB = balanceB.totalBalance;

      // Load LP balance (simplified - would need actual implementation)
      userLPBalance = 1000000000; // Example: 1 LP token
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  }

  async function handleAddLiquidity() {
    if (!wallet || !selectedPool || !selectedPoolInfo) return;

    loading = true;
    error = '';
    success = '';

    try {
      const amountAWei = parseFloat(amountA) * 1e9;
      const amountBWei = parseFloat(amountB) * 1e9;
      const minAmountAWei = amountAWei * 0.99; // 1% slippage protection
      const minAmountBWei = amountBWei * 0.99;

      const result = await addLiquidity(
        selectedPool,
        selectedPoolInfo.coinA,
        selectedPoolInfo.coinB,
        'coinAId', // Would need actual coin object IDs
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
        loadUserBalances(); // Refresh balances
      } else {
        error = `Add liquidity failed: ${result.error}`;
      }
    } catch (err) {
      error = handleTransactionError(err);
    } finally {
      loading = false;
    }
  }

  async function handleRemoveLiquidity() {
    if (!wallet || !selectedPool || !selectedPoolInfo) return;

    loading = true;
    error = '';
    success = '';

    try {
      const liquidityWei = parseFloat(liquidityToRemove) * 1e9;
      const minAmountA = 0; // Would calculate based on current pool ratio
      const minAmountB = 0;

      const result = await removeLiquidity(
        selectedPool,
        selectedPoolInfo.coinA,
        selectedPoolInfo.coinB,
        'lpTokenId', // Would need actual LP token ID
        liquidityWei,
        minAmountA,
        minAmountB,
        wallet.signer
      );

      if (result.success) {
        success = 'Liquidity removed successfully!';
        liquidityToRemove = '';
        loadUserBalances(); // Refresh balances
      } else {
        error = `Remove liquidity failed: ${result.error}`;
      }
    } catch (err) {
      error = handleTransactionError(err);
    } finally {
      loading = false;
    }
  }

  function calculateRatio() {
    if (!poolInfo || !amountA) return;
    
    const ratio = parseInt(poolInfo.reserveB) / parseInt(poolInfo.reserveA);
    amountB = (parseFloat(amountA) * ratio).toFixed(6);
  }

  function setMaxAmountA() {
    amountA = (userBalanceA / 1e9).toFixed(6);
    calculateRatio();
  }

  function setMaxAmountB() {
    amountB = (userBalanceB / 1e9).toFixed(6);
    if (poolInfo && amountB) {
      const ratio = parseInt(poolInfo.reserveA) / parseInt(poolInfo.reserveB);
      amountA = (parseFloat(amountB) * ratio).toFixed(6);
    }
  }
</script>

<div class="card">
  <h2>Liquidity Management</h2>
  
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

  {#if selectedPool && poolInfo}
    <div class="pool-stats">
      <h3>Pool Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Reserve A:</span>
          <span class="stat-value">{(parseInt(poolInfo.reserveA) / 1e9).toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Reserve B:</span>
          <span class="stat-value">{(parseInt(poolInfo.reserveB) / 1e9).toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Supply:</span>
          <span class="stat-value">{(parseInt(poolInfo.totalSupply) / 1e9).toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Fee Rate:</span>
          <span class="stat-value">{poolInfo.feeRate / 100}%</span>
        </div>
      </div>
    </div>

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
            <button type="button" on:click={setMaxAmountA} class="max-btn">MAX</button>
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
            <button type="button" on:click={setMaxAmountB} class="max-btn">MAX</button>
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
    {:else}
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

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if success}
      <div class="success">{success}</div>
    {/if}
  {/if}
</div>

<style>
  .pool-stats {
    margin: 20px 0;
  }

  .stats-grid, .balance-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 12px;
  }

  .stat-item, .balance-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
  }

  .stat-label {
    font-weight: 500;
    color: #666;
  }

  .stat-value {
    font-weight: 600;
    color: #333;
  }

  .user-balances {
    margin: 20px 0;
  }

  .tabs {
    display: flex;
    margin: 24px 0 16px 0;
    border-bottom: 2px solid #e1e5e9;
  }

  .tab-button {
    flex: 1;
    padding: 12px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-weight: 500;
    color: #666;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
  }

  .tab-button.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .tab-button:hover {
    color: #667eea;
  }

  .liquidity-form {
    max-width: 400px;
    margin: 0 auto;
  }

  .input-with-max {
    display: flex;
    gap: 8px;
  }

  .input-with-max input {
    flex: 1;
  }

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

  .max-btn:hover {
    background: #5a67d8;
  }

  .remove-btn {
    background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
  }

  .remove-btn:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.4);
  }

  .pool-selector {
    margin-bottom: 24px;
  }

  @media (max-width: 768px) {
    .stats-grid, .balance-grid {
      grid-template-columns: 1fr;
    }
  }
</style>