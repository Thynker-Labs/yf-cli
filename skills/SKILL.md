# yf-cli Skill

Use this skill when you need to fetch stock quotes or historical data from Yahoo Finance.

## When to Use

- User asks for stock quotes, prices, or market data
- User wants historical stock data
- User asks for CSV output of multiple tickers

## Tool

The `yf` CLI is installed globally. Use `exec` to run it.

```bash
yf <command> <options>
```

## Commands

### Quote
```bash
yf quote AAPL
yf quote AAPL,GOOG,MSFT
```

### Historical Data
```bash
yf history AAPL              # Last 1 month
yf history AAPL 1y           # Last 1 year
yf history AAPL 01012024-31122024  # Date range
```

### CSV Input
```bash
yf csv tickers.csv
```

### Options
- `--json` or `-j` — JSON output
- `--all` or `-a` — Show all historical data (default: last 10 rows)

## Examples

Get Apple quote:
```bash
yf quote AAPL
```

Get multiple quotes as JSON:
```bash
yf quote AAPL,MSFT,GOOG --json
```

Get 1 year history for Tesla:
```bash
yf history TSLA 1y
```

## Notes

- Ticker's workspace: `~/yf-cli`
- Install script: `./install.sh` (checks Node.js, installs, links)
- Run `yf --help` for full options
