# Cetus AMM Architecture

## Overview

Cetus AMM is a Sui Move-based Automated Market Maker implementation that provides decentralized token swapping and liquidity provision functionality. The project implements a constant product AMM (x * y = k) similar to Uniswap v2, with support for flash swaps and protocol fees.

## Module Structure

The project consists of 6 main modules organized in a hierarchical dependency structure:

```
sui/sources/
├── amm_config.move      # Global configuration and pause controls
├── amm_math.move        # Mathematical utilities
├── amm_utils.move       # AMM calculation utilities  
├── amm_swap.move        # Core pool logic and swapping
├── amm_router.move      # High-level routing and user interface
└── amm_script.move      # Entry point functions
```

## Core Components

### 1. amm_config.move
**Purpose**: Global configuration management and emergency pause functionality

**Key Structures**:
- `GlobalPauseStatus`: Controls whether the AMM can be paused globally
- `SetPauseEvent`: Event emitted when pause status changes

**Key Functions**:
- `new_global_pause_status_and_shared()`: Initialize global pause status
- `set_status_and_emit_event()`: Update pause status (admin only)
- `assert_pause()`: Check if operations are allowed

### 2. amm_math.move
**Purpose**: Safe mathematical operations to prevent overflow/underflow

**Key Functions**:
- `safe_mul_div_u64()`: Safe multiplication and division
- `safe_compare_mul_u64()`: Compare multiplication results safely
- `safe_mul_u64()`: Safe multiplication

### 3. amm_utils.move
**Purpose**: AMM-specific calculations for pricing and amounts

**Key Functions**:
- `get_amount_out()`: Calculate output amount for a given input
- `get_amount_in()`: Calculate required input for desired output
- `quote()`: Calculate equivalent amounts for liquidity provision

### 4. amm_swap.move
**Purpose**: Core pool implementation with liquidity management and swapping

**Key Structures**:
- `Pool<CoinTypeA, CoinTypeB>`: Main liquidity pool containing:
  - Token reserves (coin_a, coin_b)
  - Admin fee reserves (coin_a_admin, coin_b_admin)
  - LP token supply and locked liquidity
  - Fee configuration (trade_fee, protocol_fee)
- `PoolLiquidityCoin<CoinTypeA, CoinTypeB>`: LP token representation
- `AdminCap`: Administrative capabilities
- `FlashSwapReceipt`: Receipt for flash swap operations

**Key Functions**:
- `init_pool()`: Create new trading pool
- `flash_swap()`: Execute flash swap with deferred payment
- `repay_flash_swap()`: Repay flash swap debt
- `mint()`: Add liquidity and mint LP tokens
- `burn()`: Remove liquidity and burn LP tokens
- Various fee management functions

### 5. amm_router.move
**Purpose**: High-level interface for user operations with safety checks

**Key Functions**:
- `add_liquidity()`: Add liquidity to pools
- `remove_liquidity()`: Remove liquidity from pools
- `swap_exact_coinA_for_coinB()`: Swap exact input for minimum output
- `swap_coinA_for_exact_coinB()`: Swap maximum input for exact output
- `flash_swap()`: Flash swap with customizable parameters
- Admin functions for pool management

### 6. amm_script.move
**Purpose**: Entry point functions that can be called externally

All functions are `public entry` wrappers around `amm_router` functions, making them accessible for transaction calls.

## Architecture Patterns

### 1. Friend Module Pattern
The project uses Move's `friend` visibility to create controlled access:
- `amm_config` is friend to `amm_router` and `amm_swap`
- `amm_swap` is friend to `amm_router`
- This ensures proper encapsulation and controlled access to sensitive functions

### 2. Generic Type System
All pool operations use phantom types `<CoinTypeA, CoinTypeB>` to ensure type safety:
- Prevents mixing different token pairs
- Compile-time guarantees for correct token handling
- Type-safe LP token creation

### 3. Event-Driven Architecture
Comprehensive event emission for all major operations:
- `SwapEvent`: Token swaps
- `LiquidityEvent`: Liquidity additions/removals  
- `SetFeeEvent`: Fee configuration changes
- `ClaimFeeEvent`: Protocol fee claims

### 4. Flash Loan Pattern
Implementation of flash swaps allowing:
- Borrow tokens without upfront payment
- Execute arbitrary logic
- Repay with required tokens plus fees
- Atomic execution guarantees

## Security Features

### 1. Access Control
- `AdminCap` resource controls administrative functions
- Friend module restrictions prevent unauthorized access
- Pause functionality for emergency stops

### 2. Mathematical Safety
- Safe math operations prevent overflow/underflow
- Minimum liquidity locked to prevent division by zero
- Slippage protection on all user operations

### 3. Invariant Preservation
- Constant product formula enforcement
- LP value increase assertions during swaps
- Balance consistency checks

## Fee Structure

### 1. Trade Fees
- Configurable numerator/denominator pair
- Applied to all swaps
- Increases pool reserves

### 2. Protocol Fees
- Percentage of trade fees
- Collected in separate admin reserves
- Claimable by admin

## Data Flow

### Typical Swap Flow:
1. User calls `amm_script::swap_exact_coinA_for_coinB()`
2. `amm_router` validates inputs and pause status
3. `amm_router` calculates output amount via `amm_utils`
4. `amm_swap::flash_swap_and_emit_event()` executes swap
5. Flash swap receipt generated and immediately repaid
6. Events emitted and tokens transferred to user

### Liquidity Addition Flow:
1. User calls `amm_script::add_liquidity()`
2. `amm_router` calculates optimal amounts
3. `amm_swap::mint_and_emit_event()` mints LP tokens
4. Pool reserves updated, LP tokens sent to user

## Deployment Considerations

The AMM requires careful initialization:
1. Deploy all modules in dependency order
2. Initialize global pause status
3. Create initial pools with proper fee configurations
4. Secure admin capabilities properly

This architecture provides a robust, secure, and extensible AMM implementation suitable for production use on the Sui blockchain.