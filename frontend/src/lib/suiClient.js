import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { CONTRACT_CONFIG } from './config.js';

// Initialize Sui client
export const suiClient = new SuiClient({ 
  url: CONTRACT_CONFIG.rpc 
});

export async function executeTransactionWithRetry(txb, signer, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await suiClient.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: signer,
        options: {
          showEffects: true,
          showObjectChanges: true
        }
      });
      
      // Check if transaction was successful
      if (result.effects?.status?.status === 'success') {
        return result;
      } else {
        throw new Error('Transaction execution failed');
      }
      
    } catch (error) {
      console.error(`Transaction attempt ${i + 1} failed:`, error);
      
      if (i === maxRetries - 1) {
        throw error; // Last retry failed, throw error
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

export function handleTransactionError(error) {
  const errorMessage = error.message || error.toString();
  
  // Common error types
  if (errorMessage.includes('InsufficientBalance')) {
    return 'Insufficient balance';
  } else if (errorMessage.includes('SlippageTooHigh')) {
    return 'Slippage too high, please adjust parameters';
  } else if (errorMessage.includes('PoolPaused')) {
    return 'Pool is paused';
  } else if (errorMessage.includes('MinAmountNotMet')) {
    return 'Output amount below minimum';
  } else if (errorMessage.includes('DeadlineExceeded')) {
    return 'Transaction timeout';
  } else {
    return `Transaction failed: ${errorMessage}`;
  }
}

export async function waitForTransactionConfirmation(transactionDigest, maxWaitTime = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const txResult = await suiClient.getTransactionBlock({
        digest: transactionDigest,
        options: {
          showEffects: true
        }
      });
      
      if (txResult.effects?.status?.status === 'success') {
        console.log('Transaction confirmed:', transactionDigest);
        return { confirmed: true, result: txResult };
      } else if (txResult.effects?.status?.status === 'failure') {
        console.error('Transaction failed:', txResult.effects?.status?.error);
        return { confirmed: false, error: txResult.effects?.status?.error };
      }
      
    } catch (error) {
      console.log('Transaction not yet confirmed, waiting...');
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Transaction confirmation timeout');
}