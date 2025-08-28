# Cetus AMM Deployment Guide

## Prerequisites

Before deploying the Cetus AMM, ensure you have:

1. **Sui CLI installed**: Download from [Sui documentation](https://docs.sui.io/build/install)
2. **Active Sui wallet**: Configure with `sui client active-address`
3. **Sufficient SUI tokens**: For gas fees and initial liquidity
4. **Network configuration**: Testnet, devnet, or mainnet

## Environment Setup

### 1. Install Sui CLI
```bash
# Install Sui CLI (latest version)
cargo install --locked --git https://github.com/MystenLabs/sui.git --tag testnet-v1.14.0 sui

# Verify installation
sui --version
```

### 2. Configure Network
```bash
# For testnet deployment
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet

# For devnet deployment  
sui client new-env --alias devnet --rpc https://fullnode.devnet.sui.io:443
sui client switch --env devnet

# For mainnet deployment
sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443
sui client switch --env mainnet
```

### 3. Create/Import Wallet
```bash
# Create new wallet
sui client new-address ed25519

# Or import existing wallet
sui client import-keystore <path-to-keystore>

# Check active address and balance
sui client active-address
sui client gas
```

## Deployment Process

### Step 1: Project Preparation

1. **Clone and Navigate**
```bash
git clone <repository-url>
cd cetus-amm/sui
```

2. **Verify Move.toml Configuration**
```toml
[package]
name = "Cetus-AMM"
version = "0.0.1"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework", rev = "devnet" }

[addresses]
cetus_amm = "0x0"  # This will be auto-filled during deployment
sui = "0x2"
```

### Step 2: Build and Test

```bash
# Build the project
sui move build

# Run tests (if any)
sui move test

# Check for compilation errors
sui move build --dump-bytecode-as-base64 --dump-source-dir
```

### Step 3: Deploy Package

```bash
# Deploy to network
sui client publish --gas-budget 100000000

# Save the output - you'll need the Package ID and AdminCap object ID
```

**Important**: Save the deployment output which contains:
- Package ID (your deployed package address)
- AdminCap Object ID (needed for admin operations)
- Published objects and their IDs

### Step 4: Update Package Address

After deployment, update the `Move.toml` file with the actual package address:

```toml
[addresses]
cetus_amm = "0x<ACTUAL_PACKAGE_ID>"  # Replace with your deployed package ID
```

## Post-Deployment Setup

### Step 1: Initialize Global Pause Status

The global pause status is automatically initialized during package deployment via the `init` function in `amm_swap.move`. Note the `GlobalPauseStatus` object ID from deployment output.

### Step 2: Create Your First Pool

```bash
# Example: Create USDC/SUI pool with 0.3% trading fee and 1/6 protocol fee
sui client call \
  --package <PACKAGE_ID> \
  --module amm_script \
  --function init_pool \
  --type-args <COIN_TYPE_A> <COIN_TYPE_B> \
  --args <ADMIN_CAP_ID> 3 1000 1 6 \
  --gas-budget 10000000
```

**Parameters Explanation**:
- `<COIN_TYPE_A>`, `<COIN_TYPE_B>`: Full type names of the tokens (e.g., `0x2::sui::SUI`)
- `3 1000`: Trade fee = 3/1000 = 0.3%
- `1 6`: Protocol fee = 1/6 of trade fees ≈ 16.67%

### Step 3: Add Initial Liquidity

```bash
# Add liquidity to the pool
sui client call \
  --package <PACKAGE_ID> \
  --module amm_script \
  --function add_liquidity \
  --type-args <COIN_TYPE_A> <COIN_TYPE_B> \
  --args <POOL_ID> <GLOBAL_PAUSE_STATUS_ID> <COIN_A_OBJECT> <COIN_B_OBJECT> <AMOUNT_A> <AMOUNT_B> <MIN_A> <MIN_B> \
  --gas-budget 10000000
```

## Configuration Examples

### Production Pool Settings

**Stable Pairs (USDC/USDT)**:
```bash
# 0.05% trading fee, 20% protocol fee
--args <ADMIN_CAP> 5 10000 1 5
```

**Major Pairs (ETH/SUI)**:
```bash  
# 0.3% trading fee, 16.67% protocol fee
--args <ADMIN_CAP> 3 1000 1 6
```

**Exotic Pairs**:
```bash
# 1% trading fee, 20% protocol fee  
--args <ADMIN_CAP> 100 10000 1 5
```

## Administrative Operations

### Update Fee Configuration

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module amm_script \
  --function set_fee_config \
  --type-args <COIN_TYPE_A> <COIN_TYPE_B> \
  --args <ADMIN_CAP> <POOL_ID> <NEW_TRADE_FEE_NUM> <NEW_TRADE_FEE_DEN> <NEW_PROTOCOL_FEE_NUM> <NEW_PROTOCOL_FEE_DEN> \
  --gas-budget 10000000
```

### Claim Protocol Fees

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module amm_script \
  --function claim_fee \
  --type-args <COIN_TYPE_A> <COIN_TYPE_B> \
  --args <ADMIN_CAP> <POOL_ID> \
  --gas-budget 10000000
```

### Emergency Pause

```bash
# Pause all operations
sui client call \
  --package <PACKAGE_ID> \
  --module amm_script \
  --function set_global_pause_status \
  --args <ADMIN_CAP> <GLOBAL_PAUSE_STATUS_ID> true \
  --gas-budget 10000000

# Unpause operations
sui client call \
  --package <PACKAGE_ID> \
  --module amm_script \
  --function set_global_pause_status \
  --args <ADMIN_CAP> <GLOBAL_PAUSE_STATUS_ID> false \
  --gas-budget 10000000
```

## Integration Guide

### For Frontend Developers

**Key Object IDs to Track**:
```javascript
const CONTRACT_CONFIG = {
  packageId: "0x<PACKAGE_ID>",
  globalPauseStatusId: "0x<GLOBAL_PAUSE_STATUS_ID>",
  pools: {
    "SUI_USDC": "0x<POOL_ID>",
    // Add more pools as needed
  }
}
```

**Common Transaction Patterns**:
```javascript
// Swap exact input
await signAndExecuteTransactionBlock({
  transactionBlock: {
    moveCall: {
      target: `${packageId}::amm_script::swap_exact_coinA_for_coinB`,
      typeArguments: [COIN_TYPE_A, COIN_TYPE_B],
      arguments: [poolId, globalPauseStatusId, coinA, amountIn, minAmountOut]
    }
  }
});
```

### Pool Discovery

```bash
# Query pool reserves
sui client call \
  --package <PACKAGE_ID> \
  --module amm_swap \
  --function get_reserves \
  --type-args <COIN_TYPE_A> <COIN_TYPE_B> \
  --args <POOL_ID>
```

## Security Considerations

### 1. Admin Key Management
- Store AdminCap object ID securely
- Consider multi-sig solutions for mainnet
- Implement proper access controls

### 2. Initial Liquidity
- Add significant initial liquidity to prevent price manipulation
- Monitor for unusual trading patterns
- Set reasonable slippage protection

### 3. Fee Configuration
- Start with conservative fee settings
- Monitor protocol fee accumulation
- Regular fee optimization based on trading volume

## Troubleshooting

### Common Issues

**1. Insufficient Gas**
```bash
# Increase gas budget
--gas-budget 20000000
```

**2. Type Argument Errors**
```bash
# Ensure correct full type paths
--type-args 0x2::sui::SUI 0x<package>::usdc::USDC
```

**3. Object Not Found**
```bash
# Verify object IDs are correct and objects exist
sui client object <OBJECT_ID>
```

### Verification

```bash
# Verify deployment
sui client object <PACKAGE_ID>

# Check pool status
sui client dynamic-field <POOL_ID>

# Verify admin capabilities
sui client object <ADMIN_CAP_ID>
```

## Upgrade Process

```bash
# For package upgrades
sui client upgrade --package <PACKAGE_ID> --upgrade-capability <UPGRADE_CAP_ID> --gas-budget 100000000
```

## Monitoring

Set up monitoring for:
- Pool reserves and ratios
- Trading volume and fees
- Unusual transaction patterns
- Admin operation events

This completes the comprehensive deployment guide for the Cetus AMM on Sui.