<script>
  import { createEventDispatcher } from 'svelte';
  import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
  import { getUserBalance } from '../lib/queries.js';
  import { COMMON_COIN_TYPES } from '../lib/config.js';

  const dispatch = createEventDispatcher();

  export let wallet = null;

  let connecting = false;
  let error = '';
  let userBalances = {};

  // Simulate wallet connection (in a real app, you'd use @mysten/wallet-kit)
  async function connectWallet() {
    connecting = true;
    error = '';

    try {
      // In a real application, this would integrate with actual wallet providers
      // For demo purposes, we'll create a keypair
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

      // Load user balances
      await loadUserBalances();

    } catch (err) {
      error = `Failed to connect wallet: ${err.message}`;
      console.error('Wallet connection error:', err);
    } finally {
      connecting = false;
    }
  }

  async function disconnectWallet() {
    wallet = null;
    userBalances = {};
    dispatch('walletDisconnected');
  }

  async function loadUserBalances() {
    if (!wallet) return;

    try {
      const balancePromises = Object.entries(COMMON_COIN_TYPES).map(async ([symbol, coinType]) => {
        try {
          const balance = await getUserBalance(wallet.address, coinType);
          return [symbol, balance.totalBalance];
        } catch (err) {
          console.error(`Failed to load ${symbol} balance:`, err);
          return [symbol, 0];
        }
      });

      const balances = await Promise.all(balancePromises);
      userBalances = Object.fromEntries(balances);
    } catch (err) {
      console.error('Failed to load balances:', err);
    }
  }

  function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatBalance(balance) {
    return (balance / 1e9).toFixed(6);
  }
</script>

<div class="wallet-connection">
  {#if wallet && wallet.connected}
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
      
      <div class="wallet-details">
        <div class="address-section">
          <label>Address:</label>
          <code class="address">{formatAddress(wallet.address)}</code>
          <button 
            on:click={() => navigator.clipboard?.writeText(wallet.address)}
            class="copy-btn"
            title="Copy address"
          >
            📋
          </button>
        </div>

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
          <button on:click={loadUserBalances} class="refresh-btn">
            Refresh Balances
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="connect-section">
      <h3>Connect Wallet</h3>
      <p>Connect your wallet to start trading on Cetus AMM</p>
      
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

      <div class="wallet-options">
        <p class="note">
          In a production app, you would see options for:
        </p>
        <ul class="wallet-list">
          <li>Sui Wallet</li>
          <li>Suiet Wallet</li>
          <li>Ethos Wallet</li>
          <li>Other Sui-compatible wallets</li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .wallet-connection {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .wallet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e1e5e9;
  }

  .wallet-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .status-indicator.connected {
    background: #48bb78;
  }

  .provider-name {
    font-weight: 600;
    color: #2d3748;
  }

  .disconnect-btn {
    background: #e53e3e;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s ease;
  }

  .disconnect-btn:hover {
    background: #c53030;
  }

  .address-section {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .address-section label {
    font-weight: 500;
    color: #4a5568;
  }

  .address {
    background: #f7fafc;
    padding: 6px 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
    border: 1px solid #e2e8f0;
  }

  .copy-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .copy-btn:hover {
    background: #e2e8f0;
  }

  .balances-section h4 {
    margin: 0 0 16px 0;
    color: #2d3748;
  }

  .balances-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .balance-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f7fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .token-symbol {
    font-weight: 600;
    color: #4a5568;
  }

  .token-balance {
    font-family: monospace;
    font-weight: 500;
    color: #2d3748;
  }

  .refresh-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s ease;
  }

  .refresh-btn:hover {
    background: #5a67d8;
  }

  .connect-section {
    text-align: center;
  }

  .connect-section h3 {
    margin: 0 0 12px 0;
    color: #2d3748;
  }

  .connect-section p {
    color: #718096;
    margin-bottom: 24px;
  }

  .connect-btn {
    margin-bottom: 24px;
    min-width: 200px;
  }

  .wallet-options {
    padding: 20px;
    background: #f7fafc;
    border-radius: 8px;
    text-align: left;
  }

  .note {
    color: #718096;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .wallet-list {
    margin: 0;
    padding-left: 20px;
  }

  .wallet-list li {
    color: #4a5568;
    margin-bottom: 4px;
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .wallet-connection {
      padding: 16px;
    }

    .wallet-header {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }

    .address-section {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .balances-grid {
      grid-template-columns: 1fr;
    }
  }
</style>