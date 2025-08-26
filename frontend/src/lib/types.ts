import type { TransactionBlock } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Wallet types
export interface Wallet {
  address: string;
  signer: Ed25519Keypair;
  connected: boolean;
  provider: string;
}

// Contract configuration
export interface ContractConfig {
  packageId: string;
  globalPauseStatusId: string;
  adminCapId: string;
  upgradeCapId: string;
  network: string;
  rpc: string;
}

// Transaction result types
export interface TransactionResult {
  success: boolean;
  transactionDigest?: string;
  error?: string;
  poolId?: string;
  lpTokenId?: string;
  outputCoinId?: string;
}

// Pool information
export interface PoolInfo {
  coinTypeA: string;
  coinTypeB: string;
  reserveA: string;
  reserveB: string;
  totalSupply: string;
  feeRate: number;
  protocolFeeRate: number;
}

// Swap quote
export interface SwapQuote {
  amountOut: number;
  priceImpact: number;
  feeAmount: number;
  exchangeRate: number;
}

// User balance
export interface UserBalance {
  totalBalance: number;
  coinCount: number;
  coins: CoinInfo[];
}

export interface CoinInfo {
  coinObjectId: string;
  version: string;
  digest: string;
  balance: string;
  lockedUntilEpoch?: number;
  previousTransaction: string;
}

// Pool selection
export interface PoolOption {
  id: string;
  name: string;
  coinA: string;
  coinB: string;
}

// Transaction monitoring
export interface Transaction {
  id: number;
  digest: string;
  description: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  confirmations: number;
  error: string | null;
}

export interface TransactionConfirmation {
  confirmed: boolean;
  result?: any;
  error?: string;
}

// Common coin types
export interface CoinTypes {
  [key: string]: string;
}

// Function parameter types
export interface AddLiquidityParams {
  poolId: string;
  coinTypeA: string;
  coinTypeB: string;
  coinAId: string;
  coinBId: string;
  amountA: number;
  amountB: number;
  minAmountA: number;
  minAmountB: number;
  signer: Ed25519Keypair;
}

export interface RemoveLiquidityParams {
  poolId: string;
  coinTypeA: string;
  coinTypeB: string;
  lpTokenId: string;
  liquidity: number;
  minAmountA: number;
  minAmountB: number;
  signer: Ed25519Keypair;
}

export interface SwapParams {
  poolId: string;
  coinTypeA: string;
  coinTypeB: string;
  coinAId: string;
  amountIn: number;
  minAmountOut: number;
  signer: Ed25519Keypair;
}

export interface CreatePoolParams {
  coinTypeA: string;
  coinTypeB: string;
  feeRate: number;
  tickSpacing: number;
  sqrtPriceX64: number;
  signer: Ed25519Keypair;
}

export interface MultiHopSwapParams {
  pools: string[];
  coinTypes: string[];
  inputCoinId: string;
  amountIn: number;
  minAmountOut: number;
  signer: Ed25519Keypair;
}