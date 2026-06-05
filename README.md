# 📊 Investment Analyzer

A professional-grade, client-side **technical analysis dashboard** that provides real-time investment analysis with an aggregated **Investment Score** for multiple asset types.

> ⚠️ **Disclaimer**: This tool is for informational and educational purposes only. It is **not financial advice**. Always do your own research (DYOR) before making investment decisions.

## ✨ Features

### Multi-Asset Support
- **Crypto**: Bitcoin, Ethereum, Solana, BNB, XRP, ADA, DOGE, and more (via CoinGecko)
- **US Stocks**: AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META (via Yahoo Finance)
- **Thai Stocks**: PTT, SCC, ADVANC, CPALL, KBANK (via Yahoo Finance)
- **Commodities**: Gold, Silver, Crude Oil (via Yahoo Finance)

### Technical Analysis
- **RSI** (Relative Strength Index) — Overbought/Oversold detection
- **MACD** (Moving Average Convergence Divergence) — Momentum & trend reversals
- **Moving Averages** — SMA 20/50/200 with Golden Cross/Death Cross detection
- **Bollinger Bands** — Volatility and support/resistance levels
- **Volume Analysis** — Volume vs 20-day average confirmation

### Investment Score (0-100)
Aggregates all indicators into a single weighted score:
- 🟢 **80-100**: Strong Buy
- 🟢 **60-79**: Buy
- 🟡 **40-59**: Hold
- 🟠 **20-39**: Sell
- 🔴 **0-19**: Strong Sell

### Interactive Dashboard
- **TradingView Lightweight Charts** — Professional candlestick charts
- **Dark/Light Theme** — Bloomberg Terminal-inspired design
- **Watchlist** — Customizable, saved in localStorage
- **Multiple Timeframes** — 1D, 7D, 1M, 3M, 6M, 1Y
- **Responsive** — Desktop, Tablet, Mobile
- **Auto-refresh** — Updates every 60 seconds

## 🚀 Quick Start

### Option 1: Open directly
Simply open `index.html` in any modern browser. No build step required!

### Option 2: Live Server (recommended for development)
```bash
# Using VS Code Live Server extension
# Or using npx:
npx serve .

# Or Python:
python3 -m http.server 8000
```

## 🌐 Deploy to GitHub Pages

1. Create a new GitHub repo named `investment-analyzer`
2. Push the code:
   ```bash
   cd projects/experiments/investment-analyzer
   git init
   git add .
   git commit -m "Initial commit: Investment Analyzer"
   git remote add origin https://github.com/topsira/investment-analyzer.git
   git push -u origin main
   ```
3. Go to repo **Settings** → **Pages** → Set Source to `main` branch, root `/`
4. Access at: `https://topsira.github.io/investment-analyzer/`

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Structure** | HTML5 (Semantic) |
| **Styling** | Vanilla CSS (Custom Properties, Glassmorphism) |
| **Logic** | Vanilla JavaScript (ES6+ Modules) |
| **Charts** | [TradingView Lightweight Charts v4](https://tradingview.github.io/lightweight-charts/) |
| **Crypto Data** | [CoinGecko API](https://www.coingecko.com/en/api) (Free, no key) |
| **Stock Data** | [Yahoo Finance API](https://finance.yahoo.com/) (via CORS proxy) |
| **Hosting** | GitHub Pages (Static) |

## 📁 Project Structure

```
investment-analyzer/
├── index.html          # Main entry point
├── css/
│   └── styles.css      # Complete design system
├── js/
│   ├── app.js          # Main controller
│   ├── api.js          # Data fetching layer
│   ├── chart.js        # Chart rendering
│   ├── indicators.js   # Technical indicator calculations
│   ├── score.js        # Investment Score engine
│   ├── watchlist.js    # Watchlist management
│   └── theme.js        # Theme toggle
├── assets/
│   └── favicon.svg     # App icon
└── README.md
```

## 📊 Scoring Methodology

The Investment Score uses a weighted average of five technical indicators:

| Indicator | Weight | Rationale |
|---|---|---|
| Moving Averages | 25% | Most reliable trend identification |
| RSI | 20% | Well-known momentum oscillator |
| MACD | 20% | Trend direction + momentum |
| Volume | 20% | Confirms price movements |
| Bollinger Bands | 15% | Volatility context |

Each indicator produces a sub-score (0-100), and the final score is the weighted sum.

## 📝 License

MIT — Free to use, modify, and distribute.
