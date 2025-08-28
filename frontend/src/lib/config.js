export const CONTRACT_CONFIG = {
  // ApexYield contract package address
  packageId: "0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138",
  
  // Global pause status object (shared object)
  globalPauseStatusId: "0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b",
  
  // Admin capability object (admin only)
  adminCapId: "0x2fc12acd6dd4ac5a5e427db099a23455981b168da8309b260655947247d0ca7e",
  
  // Upgrade capability object (admin only)
  upgradeCapId: "0x64db96d87ef347cda46d3a0a53a9ad1fbdfc074ffa158e4f53b26389604ae238",
  
  // Network configuration
  network: "testnet",
  rpc: "https://fullnode.testnet.sui.io:443"
};

// Mock coins (USDC/USDT) package and admin shared objects
// TODO: After publishing `sui/mock-coins`, replace the placeholders below.
export const MOCK_COINS = {
  // The package ID returned by `sui client publish` for `sui/mock-coins`
  packageId: "0xYOUR_MOCK_COINS_PACKAGE_ID",

  // Shared Admin object IDs created on publish (one for each coin)
  usdcAdminId: "0xUSDC_ADMIN_SHARED_OBJECT_ID",
  usdtAdminId: "0xUSDT_ADMIN_SHARED_OBJECT_ID",

  // Default faucet amount (6 decimals => 1,000 tokens)
  defaultFaucetAmount: 1_000_000_000
};

export const COMMON_COIN_TYPES = {
  SUI: "0x2::sui::SUI",
  // These resolve to the freshly published mock coins when `MOCK_COINS.packageId` is set
  USDC: `${MOCK_COINS.packageId}::usdc::USDC`,
  USDT: `${MOCK_COINS.packageId}::usdt::USDT`
};

// Demo balances for testing (simulated token balances)
export const DEMO_TOKEN_BALANCES = {
  "0xa8ebd1245d9e510d6f3fda744292bcf6084833379ade79cc992e1e0911178541": {
    SUI: 10000000000,    // 10 SUI
    USDC: 1000000000,    // 1000 USDC (assuming 6 decimals, this would be 1000 tokens)
    USDT: 500000000      // 500 USDT (assuming 6 decimals, this would be 500 tokens)
  }
};

export const DEFAULT_SLIPPAGE_TOLERANCE = 1; // 1%
export const DEFAULT_FEE_RATE = 30; // 0.3%
export const DEFAULT_TICK_SPACING = 1000;
