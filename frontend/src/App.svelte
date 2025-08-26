<script>
  import WalletConnection from './components/WalletConnection.svelte';
  import SwapComponent from './components/SwapComponent.svelte';
  import LiquidityComponent from './components/LiquidityComponent.svelte';
  import TransactionMonitor from './components/TransactionMonitor.svelte';

  let wallet = null;
  let activeTab = 'swap';
  let showTransactionMonitor = false;
  let transactionMonitorRef;
  let transactions = [];

  function handleWalletConnected(event) {
    wallet = event.detail;
    console.log('Wallet connected:', wallet);
  }

  function handleWalletDisconnected() {
    wallet = null;
    console.log('Wallet disconnected');
  }

  function toggleTransactionMonitor() {
    showTransactionMonitor = !showTransactionMonitor;
  }

  function addTransaction(digest, description) {
    if (transactionMonitorRef) {
      return transactionMonitorRef.addTransaction(digest, description);
    }
  }

  // Demo function to add sample transactions (for testing)
  function addSampleTransaction() {
    const sampleDigests = [
      '0x1234567890abcdef1234567890abcdef12345678',
      '0xabcdef1234567890abcdef1234567890abcdef12',
      '0x567890abcdef1234567890abcdef1234567890ab'
    ];
    
    const randomDigest = sampleDigests[Math.floor(Math.random() * sampleDigests.length)];
    const descriptions = [
      'Token Swap: SUI → USDC',
      'Add Liquidity: SUI/USDC Pool', 
      'Remove Liquidity: USDC/USDT Pool',
      'Multi-hop Swap: SUI → USDT'
    ];
    
    const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
    addTransaction(randomDigest, randomDesc);
    showTransactionMonitor = true;
  }
</script>

<main>
  <div class="app-header">
    <div class="container">
      <div class="header-content">
        <div class="logo-section">
          <h1 class="app-title">ApexYield</h1>
          <p class="app-subtitle">Advanced DeFi Yield Optimization Platform on Sui</p>
        </div>
        
        <div class="header-actions">
          <button 
            on:click={addSampleTransaction}
            class="demo-btn"
            title="Add sample transaction (demo)"
          >
            📊 Demo Transaction
          </button>
          
          <button 
            on:click={toggleTransactionMonitor}
            class="monitor-btn"
            title="Toggle transaction monitor"
          >
            📊 Transactions ({transactions.length})
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="app-layout">
      <!-- Wallet Connection Sidebar -->
      <aside class="wallet-sidebar">
        <WalletConnection 
          bind:wallet 
          on:walletConnected={handleWalletConnected}
          on:walletDisconnected={handleWalletDisconnected}
        />
      </aside>

      <!-- Main Trading Interface -->
      <div class="trading-interface">
        <nav class="tab-navigation">
          <button 
            class="tab-btn"
            class:active={activeTab === 'swap'}
            on:click={() => activeTab = 'swap'}
          >
            🔄 Swap
          </button>
          <button 
            class="tab-btn"
            class:active={activeTab === 'liquidity'}
            on:click={() => activeTab = 'liquidity'}
          >
            💧 Liquidity
          </button>
        </nav>

        <div class="tab-content">
          {#if activeTab === 'swap'}
            <SwapComponent {wallet} />
          {:else if activeTab === 'liquidity'}
            <LiquidityComponent {wallet} />
          {/if}
        </div>

        <!-- Network Status -->
        <div class="network-status">
          <div class="status-item">
            <span class="status-label">Network:</span>
            <span class="status-value">Sui Testnet</span>
            <div class="status-indicator testnet"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Transaction Monitor Overlay -->
  <TransactionMonitor 
    bind:this={transactionMonitorRef}
    bind:visible={showTransactionMonitor}
    bind:transactions
  />

  <!-- Footer -->
  <footer class="app-footer">
    <div class="container">
      <div class="footer-content">
        <p>&copy; 2025 ApexYield. Built on Sui Blockchain.</p>
        <div class="footer-links">
          <a href="https://docs.sui.io" target="_blank" rel="noopener">Sui Docs</a>
          <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
          <a href="https://discord.gg" target="_blank" rel="noopener">Discord</a>
        </div>
      </div>
    </div>
  </footer>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding: 20px 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo-section {
    flex: 1;
  }

  .app-title {
    margin: 0;
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .app-subtitle {
    margin: 4px 0 0 0;
    color: #666;
    font-size: 1.1rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .demo-btn, .monitor-btn {
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
    border: 2px solid rgba(102, 126, 234, 0.2);
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .demo-btn:hover, .monitor-btn:hover {
    background: rgba(102, 126, 234, 0.2);
    transform: translateY(-1px);
  }

  .app-layout {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 32px;
    padding: 32px 0;
    flex: 1;
  }

  .wallet-sidebar {
    position: sticky;
    top: 120px;
    height: fit-content;
  }

  .trading-interface {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .tab-navigation {
    display: flex;
    background: white;
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    padding: 16px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    font-size: 16px;
    transition: all 0.2s ease;
    color: #666;
  }

  .tab-btn.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  .tab-btn:not(.active):hover {
    background: #f7fafc;
    color: #4a5568;
  }

  .tab-content {
    flex: 1;
  }

  .network-status {
    background: white;
    border-radius: 12px;
    padding: 16px 24px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    margin-top: auto;
  }

  .status-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .status-label {
    color: #666;
    font-weight: 500;
  }

  .status-value {
    color: #333;
    font-weight: 600;
  }

  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  .status-indicator.testnet {
    background: #ed8936;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .app-footer {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding: 24px 0;
    margin-top: 48px;
  }

  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #666;
    font-size: 14px;
  }

  .footer-links {
    display: flex;
    gap: 20px;
  }

  .footer-links a {
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .footer-links a:hover {
    color: #5a67d8;
  }

  /* Mobile Responsive */
  @media (max-width: 1024px) {
    .app-layout {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .wallet-sidebar {
      position: static;
    }
  }

  @media (max-width: 768px) {
    .app-header {
      padding: 16px 0;
    }

    .header-content {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }

    .app-title {
      font-size: 2rem;
    }

    .app-subtitle {
      font-size: 1rem;
    }

    .header-actions {
      justify-content: center;
    }

    .app-layout {
      padding: 24px 0;
      gap: 20px;
    }

    .tab-btn {
      padding: 12px 16px;
      font-size: 14px;
    }

    .footer-content {
      flex-direction: column;
      gap: 12px;
      text-align: center;
    }

    .footer-links {
      gap: 16px;
    }
  }

  @media (max-width: 480px) {
    .demo-btn, .monitor-btn {
      padding: 8px 12px;
      font-size: 12px;
    }

    .tab-navigation {
      padding: 4px;
    }

    .tab-btn {
      padding: 10px 12px;
      font-size: 13px;
    }
  }
</style>