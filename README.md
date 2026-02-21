# yf-cli

Yahoo Finance CLI - Get stock quotes and historical data from the command line.

## Installation

```bash
git clone https://github.com/thynker-labs/yf-cli.git
cd yf-cli
npm install
```

Or link globally:

```bash
npm link
```

## Usage

### Get Quote

```bash
# Single ticker
yf quote AAPL

# Multiple tickers (comma-separated)
yf quote AAPL,GOOG,MSFT
```

### CSV Input

```bash
# Create a CSV file with tickers (comma or newline separated)
echo "AAPL,GOOG,MSFT" > tickers.csv

# Or one per line:
# AAPL
# GOOG
# MSFT

yf csv tickers.csv
```

### Historical Data

```bash
# Default: last 1 month
yf history AAPL

# Standard periods
yf history AAPL 1d
yf history AAPL 5d
yf history AAPL 1mo
yf history AAPL 3mo
yf history AAPL 6mo
yf history AAPL 1y
yf history AAPL 2y
yf history AAPL 5y
yf history AAPL 10y
yf history AAPL ytd
yf history AAPL max

# Date range (DDMMYYYY-DDMMYYYY)
yf history AAPL 01012024-31122024
```

### JSON Output

Add `--json` or `-j` flag to any command for JSON output:

```bash
yf quote AAPL --json
yf csv tickers.csv --json
yf history AAPL 1y --json
```

### Show All Historical Data

By default, historical shows last 10 rows. Use `-a` or `--all` to show all:

```bash
yf history AAPL 1y --all
```

## Output Examples

### Quote Table

```
┌──────────┬──────────────────────────────┬────────────┬────────────┬──────────┬───────────────┐
│ Symbol   │ Name                         │ Price      │ Change     │ %        │ Volume        │
├──────────┼──────────────────────────────┼────────────┼────────────┼──────────┼───────────────┤
│ AAPL     │ Apple Inc.                   │ 264.58     │ 4.00       │ +1.54%   │ 36,884,993.00 │
└──────────┴──────────────────────────────┴────────────┴────────────┴──────────┴───────────────┘
```

### Historical Table

```
AAPL - Last 10 days:
┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬───────────────┐
│ Date       │ Open       │ High       │ Low        │ Close      │ Adj Close  │ Volume        │
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼───────────────┤
│ 2026-02-20 │ 258.97     │ 264.75     │ 258.16     │ 264.58     │ 264.58     │ 42,044,900.00 │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴───────────────┘
```

## Options

- `-j, --json` - Output as JSON
- `-a, --all` - Show all historical data (default: last 10 rows)
- `-h, --help` - Show help
- `-V, --version` - Show version number

## License

MIT
