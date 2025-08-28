<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { getUserBalance } from '../lib/queries.js';
  import { COMMON_COIN_TYPES } from '../lib/config.js';

  const dispatch = createEventDispatcher();

  export let wallet = null;

  let connecting = false;
  let error = '';
  let userBalances = {};
  let availableWallets = [];

  onMount(async () => {
    // Check if we're in browser environment
    if (typeof window !== 'undefined') {
      // Check for available wallets
      checkAvailableWallets();
    }
  });

  function checkAvailableWallets() {
    const wallets = [];
    
    // Check for Sui Wallet
    if (typeof window !== 'undefined' && window.suiWallet) {
      wallets.push({
        name: 'Sui Wallet',
        icon: '🦄',
        adapter: window.suiWallet
      });
    }

    // Check for Suiet Wallet
    if (typeof window !== 'undefined' && window.suiet) {
      wallets.push({
        name: 'Suiet',
        icon: '🔵',
        adapter: window.suiet
      });
    }

    // Check for Ethos Wallet
    if (typeof window !== 'undefined' && window.ethosWallet) {
      wallets.push({
        name: 'Ethos Wallet',
        icon: '⚡',
        adapter: window.ethosWallet
      });
    }

    // Check for Martian Wallet
    if (typeof window !== 'undefined' && window.martianWallet) {
      wallets.push({
        name: 'Martian Wallet',
        icon: '🚀',
        adapter: window.martianWallet
      });
    }

    // Check for OKX Wallet - try different possible global variables
    let okxAdapter = null;
    if (typeof window !== 'undefined') {
      if (window.okxwallet && window.okxwallet.sui) {
        okxAdapter = window.okxwallet.sui;
      } else if (window.okx && window.okx.sui) {
        okxAdapter = window.okx.sui;
      } else if (window.OKXWallet) {
        okxAdapter = window.OKXWallet;
      }
      
      if (okxAdapter) {
        wallets.push({
          name: 'OKX Wallet',
          icon: '⚫',
          adapter: okxAdapter
        });
      }
    }

    availableWallets = wallets;

    // If no wallets found, add demo wallet for testing
    if (wallets.length === 0) {
      availableWallets = [{
        name: 'Demo Wallet (for testing)',
        icon: '🔧',
        adapter: null
      }];
    }
  }

  async function handleConnectWallet(walletInfo) {
    connecting = true;
    error = '';

    try {
      if (!walletInfo.adapter) {
        // Demo wallet fallback
        const { Ed25519Keypair } = await import('@mysten/sui.js/keypairs/ed25519');
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
        return;
      }

      // Try to connect to real wallet
      const adapter = walletInfo.adapter;
      let response;
      
      // Handle different wallet connection patterns
      if (walletInfo.name === 'OKX Wallet') {
        // OKX Wallet connection - try different methods
        console.log('OKX Wallet adapter available methods:', Object.getOwnPropertyNames(adapter));
        let account = null;
        
        try {
          // Method 1: Try standard connect
          response = await adapter.connect();
          console.log('OKX Wallet connect response:', response);
          
          // Try different possible response structures for OKX
          if (response && response.address) {
            // Direct address in response
            account = {
              address: response.address,
              publicKey: response.publicKey
            };
          } else if (response && response.accounts && response.accounts.length > 0) {
            // Accounts array (similar to other wallets)
            account = response.accounts[0];
          } else if (response && Array.isArray(response) && response.length > 0) {
            // Response is directly an array of accounts
            account = response[0];
          }
        } catch (connectError) {
          console.log('Standard connect failed, trying alternative methods:', connectError);
        }
        
        // Method 2: Try getAccounts if connect didn't work
        if (!account && adapter.getAccounts) {
          try {
            const accounts = await adapter.getAccounts();
            console.log('OKX getAccounts response:', accounts);
            if (accounts && accounts.length > 0) {
              account = accounts[0];
            }
          } catch (getAccountsError) {
            console.log('getAccounts failed:', getAccountsError);
          }
        }
        
        // Method 3: Try requestAccounts if available
        if (!account && adapter.requestAccounts) {
          try {
            const accounts = await adapter.requestAccounts();
            console.log('OKX requestAccounts response:', accounts);
            if (accounts && accounts.length > 0) {
              account = accounts[0];
            }
          } catch (requestAccountsError) {
            console.log('requestAccounts failed:', requestAccountsError);
          }
        }
        
        if (account && account.address) {
          const newWallet = {
            address: account.address,
            signer: adapter,
            connected: true,
            provider: walletInfo.name,
            publicKey: account.publicKey
          };

          wallet = newWallet;
          dispatch('walletConnected', wallet);
          await loadUserBalances();
        } else {
          console.error('All OKX connection methods failed. Final state:', { response, account, adapter });
          throw new Error('OKX Wallet connection failed. Please ensure the wallet is installed and unlocked.');
        }
      } else {
        // Standard wallet connection for other wallets
        response = await adapter.connect();
        
        if (response && response.accounts && response.accounts.length > 0) {
          const account = response.accounts[0];
          
          const newWallet = {
            address: account.address,
            signer: adapter,
            connected: true,
            provider: walletInfo.name,
            publicKey: account.publicKey
          };

          wallet = newWallet;
          dispatch('walletConnected', wallet);
          await loadUserBalances();
        } else {
          throw new Error('No accounts returned from wallet');
        }
      }
      
    } catch (err) {
      console.error('Wallet connection error:', err);
      
      if (err.message.includes('rejected') || err.message.includes('denied')) {
        error = 'Connection rejected by user';
      } else if (err.message.includes('not found') || err.message.includes('not installed')) {
        error = `${walletInfo.name} is not installed. Please install it first.`;
      } else {
        error = `Failed to connect ${walletInfo.name}: ${err.message}`;
      }
    } finally {
      connecting = false;
    }
  }

  async function handleDisconnectWallet() {
    try {
      if (wallet && wallet.signer && wallet.signer.disconnect) {
        await wallet.signer.disconnect();
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
    
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
        <button on:click={handleDisconnectWallet} class="disconnect-btn">
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
      <p>Connect your wallet to start trading on ApexYield AMM</p>
      
      {#if error}
        <div class="error">{error}</div>
      {/if}

      <div class="wallet-options">
        <div class="wallet-grid">
          {#each availableWallets as walletInfo}
            <button 
              on:click={() => handleConnectWallet(walletInfo)}
              disabled={connecting}
              class="wallet-button"
            >
              <div class="wallet-icon">{walletInfo.icon}</div>
              <span>{walletInfo.name}</span>
            </button>
          {/each}
        </div>

        {#if connecting}
          <div class="connecting-message">
            <div class="spinner"></div>
            <span>Connecting to wallet...</span>
          </div>
        {/if}

        <div class="wallet-note">
          <p>
            {#if availableWallets.length === 1 && availableWallets[0].name.includes('Demo')}
              No Sui wallets detected. Install one of the supported wallets for real functionality.
            {:else}
              Don't have a wallet? Install one of the supported wallets above.
            {/if}
          </p>
          <div class="wallet-links">
            <a href="https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil" target="_blank">Sui Wallet</a>
            <a href="https://chrome.google.com/webstore/detail/suiet-sui-wallet/khpkpbbcccdmmclmpigdgddabeilkdpd" target="_blank">Suiet</a>
            <a href="https://chrome.google.com/webstore/detail/ethos-sui-wallet/mcbigmjiafegjnnogedioegffbooigli" target="_blank">Ethos</a>
            <a href="https://chrome.google.com/webstore/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge" target="_blank">OKX Wallet</a>
          </div>
        </div>
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

  .wallet-options {
    text-align: center;
  }

  .wallet-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }

  .wallet-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
    color: #2d3748;
  }

  .wallet-button:hover:not(:disabled) {
    border-color: #667eea;
    background: #f7fafc;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  }

  .wallet-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .wallet-icon {
    font-size: 24px;
  }

  .connecting-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 16px 0;
    color: #667eea;
    font-weight: 500;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .wallet-note {
    padding: 16px;
    background: #f7fafc;
    border-radius: 8px;
    border-left: 4px solid #667eea;
    text-align: left;
  }

  .wallet-note p {
    margin: 0 0 12px 0;
    color: #4a5568;
    font-size: 14px;
  }

  .wallet-links {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .wallet-links a {
    color: #667eea;
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    background: white;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .wallet-links a:hover {
    background: #e2e8f0;
  }

  .error {
    background: #fed7d7;
    color: #e53e3e;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    border-left: 4px solid #e53e3e;
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

    .wallet-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .wallet-button {
      padding: 16px 12px;
    }

    .wallet-links {
      justify-content: center;
    }
  }
</style>