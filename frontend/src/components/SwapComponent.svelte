<script>
  import { onMount } from 'svelte';
  import { swapExactAForB } from '../lib/ammFunctions.js';
  import { getSwapQuote, calculateMinAmountWithSlippage } from '../lib/queries.js';
  import { handleTransactionError } from '../lib/suiClient.js';
  import { COMMON_COIN_TYPES, DEFAULT_SLIPPAGE_TOLERANCE } from '../lib/config.js';

  export let wallet;
  export let selectedPool = '';

  let fromAmount = '';
  let toAmount = '';
  let quote = null;
  let loading = false;
  let error = '';
  let success = '';
  let slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE;
  
  // Available pools (would be loaded dynamically in a real app)
  let availablePools = [
    { id: 'pool1', name: 'SUI/USDC', coinA: COMMON_COIN_TYPES.SUI, coinB: COMMON_COIN_TYPES.USDC },
    { id: 'pool2', name: 'USDC/USDT', coinA: COMMON_COIN_TYPES.USDC, coinB: COMMON_COIN_TYPES.USDT }
  ];

  // Get quote when input changes
  $: if (fromAmount && selectedPool && !loading) {
    debounceGetQuote();
  }

  // Update output amount when quote changes
  $: if (quote) {
    toAmount = (quote.amountOut / 1e9).toFixed(6);
  }

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
    }, 500);
  }

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

      // Check price impact
      if (quote.priceImpact > 5) {
        const confirmed = confirm(`High price impact (${quote.priceImpact.toFixed(2)}%). Continue?`);
        if (!confirmed) {
          loading = false;
          return;
        }
      }

      const selectedPoolInfo = availablePools.find(p => p.id === selectedPool);
      
      const result = await swapExactAForB(
        selectedPool,
        selectedPoolInfo.coinA,
        selectedPoolInfo.coinB,
        'coinAId', // Would need actual coin object ID
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

  function switchTokens() {
    [fromAmount, toAmount] = [toAmount, fromAmount];
    // Would also need to switch the selected pool direction
  }
</script>

<div class="card">
  <h2>Token Swap</h2>
  
  <div class="swap-form">
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

    <div class="swap-arrow">
      <button type="button" on:click={switchTokens} class="switch-btn">⇅</button>
    </div>

    <div class="input-group">
      <label>To</label>
      <input
        type="number"
        bind:value={toAmount}
        placeholder="Output amount"
        readonly
      />
    </div>

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

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if success}
      <div class="success">{success}</div>
    {/if}

    <button 
      on:click={handleSwap} 
      disabled={loading || !quote || !wallet}
      class="primary-button"
    >
      {loading ? 'Swapping...' : 'Swap'}
    </button>
  </div>
</div>

<style>
  .swap-form {
    max-width: 400px;
    margin: 0 auto;
  }

  .swap-arrow {
    text-align: center;
    margin: 16px 0;
  }

  .switch-btn {
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

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
    margin-top: 8px;
  }

  select {
    width: 100%;
    margin-top: 8px;
  }
</style>