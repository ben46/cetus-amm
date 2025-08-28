#!/usr/bin/env node
import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { MOCK_COINS, CONTRACT_CONFIG } from '../src/lib/config.js';

// This script assumes you will execute via a wallet adapter in-app,
// but provides raw tx blocks for CLI use with `sui client dry-run` or signers.

async function main() {
  const [address] = process.argv.slice(2);
  if (!MOCK_COINS.packageId.startsWith('0x')) {
    console.error('Please set MOCK_COINS.packageId in frontend/src/lib/config.js');
    process.exit(1);
  }
  if (!MOCK_COINS.usdcAdminId.startsWith('0x') || !MOCK_COINS.usdtAdminId.startsWith('0x')) {
    console.error('Please set MOCK_COINS.usdcAdminId and usdtAdminId in frontend/src/lib/config.js');
    process.exit(1);
  }

  const client = new SuiClient({ url: CONTRACT_CONFIG.rpc });

  console.log('Preparing register + faucet transactions for:', address || '(connected wallet)');

  const txb = new TransactionBlock();
  txb.moveCall({ target: `${MOCK_COINS.packageId}::usdc::register` });
  txb.moveCall({ target: `${MOCK_COINS.packageId}::usdt::register` });
  txb.moveCall({
    target: `${MOCK_COINS.packageId}::usdc::faucet`,
    arguments: [txb.object(MOCK_COINS.usdcAdminId), txb.pure.u64(MOCK_COINS.defaultFaucetAmount)],
  });
  txb.moveCall({
    target: `${MOCK_COINS.packageId}::usdt::faucet`,
    arguments: [txb.object(MOCK_COINS.usdtAdminId), txb.pure.u64(MOCK_COINS.defaultFaucetAmount)],
  });

  console.log('Tx prepared. Use in-app wallet signing to execute.');
  console.log('Targets:');
  console.log('-', `${MOCK_COINS.packageId}::usdc::register`);
  console.log('-', `${MOCK_COINS.packageId}::usdt::register`);
  console.log('-', `${MOCK_COINS.packageId}::usdc::faucet`, MOCK_COINS.usdcAdminId, MOCK_COINS.defaultFaucetAmount);
  console.log('-', `${MOCK_COINS.packageId}::usdt::faucet`, MOCK_COINS.usdtAdminId, MOCK_COINS.defaultFaucetAmount);

  // Intentionally not sending, since this script doesn't have a signer.
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

