import { TransactionBlock } from '@mysten/sui.js/transactions';
import { MOCK_COINS } from './config.js';
import { suiClient, executeTransactionWithRetry } from './suiClient.js';

export async function registerUSDC(signer) {
  const txb = new TransactionBlock();
  txb.moveCall({ target: `${MOCK_COINS.packageId}::usdc::register` });
  return executeTransactionWithRetry(txb, signer);
}

export async function registerUSDT(signer) {
  const txb = new TransactionBlock();
  txb.moveCall({ target: `${MOCK_COINS.packageId}::usdt::register` });
  return executeTransactionWithRetry(txb, signer);
}

export async function faucetUSDC(amount = MOCK_COINS.defaultFaucetAmount, signer) {
  if (!MOCK_COINS.usdcAdminId || MOCK_COINS.usdcAdminId.includes('ADMIN_SHARED_OBJECT_ID')) {
    throw new Error('MOCK_COINS.usdcAdminId is not set. Update config.js with the shared Admin ID.');
  }
  const txb = new TransactionBlock();
  txb.moveCall({
    target: `${MOCK_COINS.packageId}::usdc::faucet`,
    arguments: [
      txb.object(MOCK_COINS.usdcAdminId),
      txb.pure.u64(amount)
    ],
  });
  return executeTransactionWithRetry(txb, signer);
}

export async function faucetUSDT(amount = MOCK_COINS.defaultFaucetAmount, signer) {
  if (!MOCK_COINS.usdtAdminId || MOCK_COINS.usdtAdminId.includes('ADMIN_SHARED_OBJECT_ID')) {
    throw new Error('MOCK_COINS.usdtAdminId is not set. Update config.js with the shared Admin ID.');
  }
  const txb = new TransactionBlock();
  txb.moveCall({
    target: `${MOCK_COINS.packageId}::usdt::faucet`,
    arguments: [
      txb.object(MOCK_COINS.usdtAdminId),
      txb.pure.u64(amount)
    ],
  });
  return executeTransactionWithRetry(txb, signer);
}

export async function registerAndFaucetBoth(amountUSDC = MOCK_COINS.defaultFaucetAmount, amountUSDT = MOCK_COINS.defaultFaucetAmount, signer) {
  await registerUSDC(signer);
  await registerUSDT(signer);
  await faucetUSDC(amountUSDC, signer);
  await faucetUSDT(amountUSDT, signer);
}

