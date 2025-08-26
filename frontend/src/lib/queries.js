import { suiClient } from './suiClient.js';

/**
 * Get pool information
 */
export async function getPoolInfo(poolId) {
  try {
    const poolObject = await suiClient.getObject({
      id: poolId,
      options: {
        showContent: true,
        showType: true
      }
    });
    
    if (poolObject.data?.content?.dataType === 'moveObject') {
      const fields = poolObject.data.content.fields;
      
      return {
        coinTypeA: fields.coin_type_a,
        coinTypeB: fields.coin_type_b,
        reserveA: fields.reserve_a,
        reserveB: fields.reserve_b,
        totalSupply: fields.lp_supply,
        feeRate: fields.fee_rate,
        protocolFeeRate: fields.protocol_fee_rate
      };
    }
    
    throw new Error('Unable to get pool information');
    
  } catch (error) {
    console.error('Get pool info failed:', error);
    throw error;
  }
}

/**
 * Calculate swap output amount (without executing transaction)
 */
export function calculateAmountOut(amountIn, reserveIn, reserveOut, feeRate = 30) {
  const amountInWithFee = amountIn * (10000 - feeRate);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000 + amountInWithFee;
  return Math.floor(numerator / denominator);
}

/**
 * Calculate price impact
 */
export function calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut) {
  const preBuyPrice = reserveOut / reserveIn;
  const postBuyPrice = (reserveOut - amountOut) / (reserveIn + amountIn);
  return Math.abs((postBuyPrice - preBuyPrice) / preBuyPrice) * 100;
}

/**
 * Get swap quote
 */
export async function getSwapQuote(poolId, amountIn, swapAForB = true) {
  try {
    const poolInfo = await getPoolInfo(poolId);
    
    const [reserveIn, reserveOut] = swapAForB 
      ? [poolInfo.reserveA, poolInfo.reserveB]
      : [poolInfo.reserveB, poolInfo.reserveA];
    
    const amountOut = calculateAmountOut(
      amountIn, 
      parseInt(reserveIn), 
      parseInt(reserveOut), 
      poolInfo.feeRate
    );
    
    const priceImpact = calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);
    
    return {
      amountOut,
      priceImpact,
      feeAmount: Math.floor(amountIn * poolInfo.feeRate / 10000),
      exchangeRate: amountOut / amountIn
    };
    
  } catch (error) {
    console.error('Get swap quote failed:', error);
    throw error;
  }
}

/**
 * Get user token balance
 */
export async function getUserBalance(userAddress, coinType) {
  try {
    const coins = await suiClient.getCoins({
      owner: userAddress,
      coinType: coinType
    });
    
    const totalBalance = coins.data.reduce((sum, coin) => 
      sum + parseInt(coin.balance), 0
    );
    
    return {
      totalBalance,
      coinCount: coins.data.length,
      coins: coins.data
    };
    
  } catch (error) {
    console.error('Get balance failed:', error);
    throw error;
  }
}

/**
 * Calculate minimum amount with slippage protection
 */
export function calculateMinAmountWithSlippage(expectedAmount, slippageTolerance = 1) {
  return Math.floor(expectedAmount * (100 - slippageTolerance) / 100);
}