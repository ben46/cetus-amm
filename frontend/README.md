# ApexYield Frontend

A modern, responsive frontend application for ApexYield - an advanced DeFi yield optimization platform built with Svelte and integrated with Sui blockchain.

## Features

- **Token Swapping**: Swap between different tokens with real-time price quotes and slippage protection
- **Liquidity Management**: Add and remove liquidity from trading pools
- **Wallet Integration**: Connect to Sui-compatible wallets
- **Transaction Monitoring**: Real-time transaction status tracking
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Price Impact Warnings**: Alerts users about high price impact trades

## Technology Stack

- **Frontend Framework**: Svelte 3
- **Blockchain Integration**: Sui.js SDK
- **Build Tool**: Rollup
- **Styling**: CSS with responsive design
- **Package Manager**: npm

## Project Structure

```
frontend/
├── public/
│   ├── index.html          # Main HTML template
│   └── global.css          # Global styles
├── src/
│   ├── components/         # Svelte components
│   │   ├── SwapComponent.svelte
│   │   ├── LiquidityComponent.svelte
│   │   ├── WalletConnection.svelte
│   │   └── TransactionMonitor.svelte
│   ├── lib/               # Utility libraries
│   │   ├── config.js      # Contract configuration (incl. MOCK_COINS)
│   │   ├── mockCoins.js   # Helpers: register + faucet mock USDC/USDT
│   │   ├── suiClient.js   # Sui client setup
│   │   ├── ammFunctions.js # AMM interaction functions
│   │   └── queries.js     # Query utilities
│   ├── App.svelte         # Main application component
│   └── main.js            # Application entry point
├── package.json
├── rollup.config.js       # Rollup configuration
└── README.md
```

## Installation

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5000`

3. **Build for Production**
   ```bash
   npm run build
   ```

## Configuration

ApexYield is configured to work with Sui Testnet. Update the contract addresses in `src/lib/config.js` if needed:

```javascript
export const CONTRACT_CONFIG = {
  packageId: "0xe2f4a0385a2b5e31f67095fb4ba99e3048eb05012ba3698ef6c80fbb675fe138",
  globalPauseStatusId: "0x27a51b2510dd1dcf2949197eda3a4ec4bb71100cc2fc873fcbf772e47d8e975b",
  // ... other configuration
};
```

## Usage

### Connecting a Wallet

1. **Real Wallet Support**: The app now supports real Sui wallets including:
   - Sui Wallet 🦄
   - Suiet 🔵
   - Ethos Wallet ⚡
   - Martian Wallet 🚀
   - OKX Wallet ⚫

2. **Installation**: If no wallets are detected, installation links are provided
3. **Demo Fallback**: When no real wallets are available, a demo wallet option is shown for testing

### Mock Coins (USDC/USDT)

- Set `MOCK_COINS.packageId`, `usdcAdminId`, and `usdtAdminId` in `src/lib/config.js` after publishing `sui/mock-coins`.
- Use `register-and-faucet.js` or in-app flows to register coin types and mint faucet amounts to the connected wallet.
- Default faucet amount is `1_000_000_000` (1,000 tokens with 6 decimals).

### Token Swapping

1. Select a trading pair from the dropdown
2. Enter the amount to swap
3. Review the quote, including exchange rate and price impact
4. Click "Swap" to execute the transaction

### Managing Liquidity

1. Switch to the "Liquidity" tab
2. Select a pool to add liquidity to
3. Enter amounts for both tokens (amounts will auto-balance based on pool ratio)
4. Click "Add Liquidity" to provide liquidity
5. Use "Remove Liquidity" tab to withdraw your position

### Transaction Monitoring

- Click the "📊 Transactions" button to view pending and completed transactions
- Transactions show real-time status updates
- Click on transaction hashes to view in block explorer

## Core Components

### SwapComponent
- Handles token swapping functionality
- Real-time price quotes and slippage calculation
- Price impact warnings for large trades

### LiquidityComponent
- Add/remove liquidity functionality
- Pool statistics display
- User balance tracking

### WalletConnection
- Wallet connection and management
- User balance display
- Address copying and management

### TransactionMonitor
- Real-time transaction status tracking
- Transaction history with explorer links
- Error handling and retry mechanisms

## Integration with Sui

The frontend integrates with Sui blockchain using:

- **@mysten/sui.js**: Core Sui SDK for blockchain interactions
- **Transaction Blocks**: For composing and executing transactions
- **Object Management**: Handling Sui objects and references
- **Event Monitoring**: Real-time transaction status updates

## Responsive Design

The application is fully responsive and includes:

- **Desktop**: Full-featured layout with sidebar
- **Tablet**: Stacked layout with touch-friendly controls
- **Mobile**: Optimized mobile experience with collapsible sections

## Development

### Available Scripts

- `npm run dev`: Start development server with hot reload
- `npm run build`: Build for production
- `npm run start`: Serve production build
- `npm run lint`: Run ESLint
- `npm run check`: Run Svelte type checking

### Adding New Features

1. Create new components in `src/components/`
2. Add new AMM functions in `src/lib/ammFunctions.js`
3. Update configuration in `src/lib/config.js` as needed
4. Import and use in `App.svelte`

## Security Considerations

- **Slippage Protection**: All trades include configurable slippage protection
- **Price Impact Warnings**: Users are warned about high-impact trades
- **Transaction Validation**: All transactions are validated before execution
- **Error Handling**: Comprehensive error handling and user feedback

## Browser Support

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ApexYield is licensed under the MIT License.

## Support

For ApexYield support:
- Check the documentation in `/ai/FRONTEND_INTEGRATION_CN.md`
- Review the contract source code in `/sui/sources/`
- Open an issue on GitHub

---

ApexYield - Built with ❤️ on Sui Blockchain
