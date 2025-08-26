import { TransactionBlock } from '@mysten/sui.js/transactions';
import { CONTRACT_CONFIG, DEFAULT_FEE_RATE, DEFAULT_TICK_SPACING } from './config.js';
import { suiClient, executeTransactionWithRetry } from './suiClient.js';

/**
 * Create new trading pool (Admin only)
 */
export async function createPool(coinTypeA, coinTypeB, feeRate = 30, tickSpacing = 1000, sqrtPriceX64 = 1, signer) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::init_pool`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(CONTRACT_CONFIG.adminCapId),  // AdminCap
        txb.pure(feeRate),                       // Fee rate
        txb.pure(tickSpacing),                   // Tick spacing
        txb.pure(sqrtPriceX64),                  // Initial price
        txb.pure(6)                              // Protocol fee rate
      ]
    });
    
    const result = await executeTransactionWithRetry(txb, signer);
    
    // Extract Pool object ID from result
    const poolObject = result.objectChanges?.find(
      obj => obj.type === 'created' && obj.objectType.includes('Pool')
    );
    
    return {
      success: true,
      poolId: poolObject?.objectId,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('Pool creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add liquidity to pool
 */
export async function addLiquidity(poolId, coinTypeA, coinTypeB, coinAId, coinBId, amountA, amountB, minAmountA, minAmountB, signer) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::add_liquidity`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(poolId),                           // Pool object
        txb.object(CONTRACT_CONFIG.globalPauseStatusId), // Global pause status
        txb.object(coinAId),                          // Coin A
        txb.object(coinBId),                          // Coin B
        txb.pure(amountA),                            // Amount A
        txb.pure(amountB),                            // Amount B
        txb.pure(minAmountA),                         // Min amount A
        txb.pure(minAmountB)                          // Min amount B
      ]
    });
    
    const result = await executeTransactionWithRetry(txb, signer);
    
    // Extract LP token object ID
    const lpTokenObject = result.objectChanges?.find(
      obj => obj.type === 'created' && obj.objectType.includes('LpToken')
    );
    
    return {
      success: true,
      lpTokenId: lpTokenObject?.objectId,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('Add liquidity failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Remove liquidity from pool
 */
export async function removeLiquidity(poolId, coinTypeA, coinTypeB, lpTokenId, liquidity, minAmountA, minAmountB, signer) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::remove_liquidity`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(poolId),                           // Pool object
        txb.object(CONTRACT_CONFIG.globalPauseStatusId), // Global pause status
        txb.object(lpTokenId),                        // LP token
        txb.pure(liquidity),                          // Liquidity amount
        txb.pure(minAmountA),                         // Min amount A
        txb.pure(minAmountB)                          // Min amount B
      ]
    });
    
    const result = await executeTransactionWithRetry(txb, signer);
    
    return {
      success: true,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('Remove liquidity failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Swap exact coin A for coin B
 */
export async function swapExactAForB(poolId, coinTypeA, coinTypeB, coinAId, amountIn, minAmountOut, signer) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::swap_exact_coinA_for_coinB`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(poolId),                           // Pool object
        txb.object(CONTRACT_CONFIG.globalPauseStatusId), // Global pause status
        txb.object(coinAId),                          // Input coin A
        txb.pure(amountIn),                           // Input amount
        txb.pure(minAmountOut)                        // Min output amount
      ]
    });
    
    const result = await executeTransactionWithRetry(txb, signer);
    
    // Extract output coin B object ID
    const coinBObject = result.objectChanges?.find(
      obj => obj.type === 'created' && obj.objectType.includes(coinTypeB)
    );
    
    return {
      success: true,
      outputCoinId: coinBObject?.objectId,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('Token swap failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Swap coin A for exact coin B
 */
export async function swapAForExactB(poolId, coinTypeA, coinTypeB, coinAId, amountOut, maxAmountIn, signer) {
  try {
    const txb = new TransactionBlock();
    
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_script::swap_coinA_for_exact_coinB`,
      typeArguments: [coinTypeA, coinTypeB],
      arguments: [
        txb.object(poolId),
        txb.object(CONTRACT_CONFIG.globalPauseStatusId),
        txb.object(coinAId),
        txb.pure(maxAmountIn),
        txb.pure(amountOut)
      ]
    });
    
    const result = await executeTransactionWithRetry(txb, signer);
    
    return {
      success: true,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('Exact output swap failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Multi-hop swap (routing)
 */
export async function multiHopSwap(pools, coinTypes, inputCoinId, amountIn, minAmountOut, signer) {
  try {
    const txb = new TransactionBlock();
    
    // Build multi-hop swap path
    txb.moveCall({
      target: `${CONTRACT_CONFIG.packageId}::amm_router::swap_exact_input`,
      typeArguments: coinTypes,
      arguments: [
        txb.makeMoveVec({ objects: pools.map(pool => txb.object(pool)) }),
        txb.object(CONTRACT_CONFIG.globalPauseStatusId),
        txb.object(inputCoinId),
        txb.pure(amountIn),
        txb.pure(minAmountOut)
      ]
    });
    
    const result = await executeTransactionWithRetry(txb, signer);
    
    return {
      success: true,
      transactionDigest: result.digest
    };
    
  } catch (error) {
    console.error('Multi-hop swap failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}