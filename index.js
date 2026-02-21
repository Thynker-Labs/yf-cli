#!/usr/bin/env node

const { program } = require('commander');
const Table = require('cli-table3');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const fs = require('fs');

// Parse tickers from string (comma-separated or one per line)
function parseTickers(input) {
  if (!input) return [];
  return input
    .split(/[,\n]/)
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
}

// Format number with commas
function formatNum(n) {
  if (n === null || n === undefined) return 'N/A';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format percentage
function formatPct(n) {
  if (n === null || n === undefined) return 'N/A';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

// Format date for display
function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

// Get quote data
async function getQuote(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    return {
      symbol: quote.symbol,
      name: quote.shortName || quote.longName || ticker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePct: quote.regularMarketChangePercent,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      peRatio: quote.trailingPE,
      previousClose: quote.regularMarketPreviousClose,
      exchange: quote.exchange,
    };
  } catch (err) {
    return { symbol: ticker, error: err.message };
  }
}

// Get historical data
async function getHistorical(ticker, period) {
  try {
    let periodObj;
    
    // Check if it's a date range (DDMMYYYY-DDMMYYYY)
    const dateRangeMatch = period.match(/^(\d{8})-(\d{8})$/);
    if (dateRangeMatch) {
      const parseDate = (d) => {
        const day = d.slice(0, 2);
        const month = d.slice(2, 4);
        const year = d.slice(4, 8);
        return new Date(`${year}-${month}-${day}`);
      };
      periodObj = {
        period1: parseDate(dateRangeMatch[1]),
        period2: parseDate(dateRangeMatch[2]),
      };
    } else {
      // Convert period strings to date ranges
      const now = new Date();
      let startDate = new Date(now);
      
      const periodMap = {
        '1d': 1,
        '5d': 5,
        '1mo': 30,
        '3mo': 90,
        '6mo': 180,
        '1y': 365,
        '2y': 730,
        '5y': 1825,
        '10y': 3650,
      };
      
      if (period === 'ytd') {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else if (period === 'max') {
        startDate = new Date(1900, 0, 1);
      } else if (periodMap[period]) {
        startDate.setDate(startDate.getDate() - periodMap[period]);
      } else {
        throw new Error(`Invalid period. Use: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max, or DDMMYYYY-DDMMYYYY`);
      }
      
      periodObj = {
        period1: startDate,
        period2: now,
      };
    }
    
    const history = await yahooFinance.historical(ticker, periodObj);
    return history.map(h => ({
      date: formatDate(h.date),
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume,
      adjClose: h.adjClose,
    }));
  } catch (err) {
    return { symbol: ticker, error: err.message };
  }
}

// Display quote as table
function displayQuoteTable(data) {
  if (data.error) {
    console.log(`Error: ${data.error}`);
    return;
  }

  const table = new Table({
    head: ['Symbol', 'Name', 'Price', 'Change', '%', 'Volume'],
    colWidths: [10, 30, 12, 12, 10, 15],
  });

  table.push([
    data.symbol,
    data.name?.substring(0, 28) || 'N/A',
    data.price ? formatNum(data.price) : 'N/A',
    data.change ? formatNum(data.change) : 'N/A',
    data.changePct ? formatPct(data.changePct) : 'N/A',
    data.volume ? formatNum(data.volume) : 'N/A',
  ]);

  console.log(table.toString());

  // Additional details
  const details = new Table({ chars: { top: '', 'top-mid': '', 'top-left': '', 'top-right': '', bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '', left: '', 'left-mid': '', mid: '', 'mid-mid': '', right: '', 'right-mid': '', dash: '', 'dash-mid': '', 'dash-left': '', 'dash-right': '', space: '' } });
  
  details.push(
    ['Open', data.open ? formatNum(data.open) : 'N/A'],
    ['Prev Close', data.previousClose ? formatNum(data.previousClose) : 'N/A'],
    ['Day High', data.high ? formatNum(data.high) : 'N/A'],
    ['Day Low', data.low ? formatNum(data.low) : 'N/A'],
    ['Market Cap', data.marketCap ? formatNum(data.marketCap) : 'N/A'],
    ['P/E Ratio', data.peRatio ? formatNum(data.peRatio) : 'N/A'],
    ['Exchange', data.exchange || 'N/A'],
  );
  
  console.log(details.toString());
}

// Display historical as table
function displayHistoricalTable(data, symbol, showAll) {
  if (data.error) {
    console.log(`Error for ${symbol}: ${data.error}`);
    return;
  }

  if (!data.length) {
    console.log('No historical data found.');
    return;
  }

  const displayData = showAll ? data : data.slice(-10);
  
  const table = new Table({
    head: ['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume'],
    colWidths: [12, 12, 12, 12, 12, 12, 15],
  });

  displayData.forEach(row => {
    table.push([
      row.date,
      formatNum(row.open),
      formatNum(row.high),
      formatNum(row.low),
      formatNum(row.close),
      formatNum(row.adjClose),
      formatNum(row.volume),
    ]);
  });

  console.log(`\n${symbol} - Last ${displayData.length} days:`);
  console.log(table.toString());
}

// Main command
program
  .name('yf')
  .description('Yahoo Finance CLI - Get stock quotes and historical data')
  .version('1.0.0');

program
  .command('quote')
  .description('Get quote for one or more tickers')
  .argument('<tickers>', 'Ticker(s): single (AAPL) or comma-separated (AAPL,GOOG)')
  .option('-j, --json', 'Output as JSON')
  .action(async (tickers, options) => {
    const tickerList = parseTickers(tickers);
    const results = await Promise.all(tickerList.map(t => getQuote(t)));
    
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      results.forEach(r => displayQuoteTable(r));
    }
  });

program
  .command('csv')
  .description('Read tickers from a CSV file')
  .argument('<file>', 'Path to CSV file (one ticker per line or comma-separated)')
  .option('-j, --json', 'Output as JSON')
  .action(async (file, options) => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const tickerList = parseTickers(content);
      
      if (!tickerList.length) {
        console.log('No tickers found in file.');
        return;
      }

      console.log(`Processing ${tickerList.length} ticker(s)...\n`);
      const results = await Promise.all(tickerList.map(t => getQuote(t)));
      
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        results.forEach(r => displayQuoteTable(r));
      }
    } catch (err) {
      console.error(`Error reading file: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('Get historical data for a ticker')
  .argument('<ticker>', 'Stock ticker symbol (e.g., AAPL)')
  .argument('[period]', 'Period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max) or date range (DDMMYYYY-DDMMYYYY)', '1mo')
  .option('-j, --json', 'Output as JSON')
  .option('-a, --all', 'Show all data (default shows last 10 rows)')
  .action(async (ticker, period, options) => {
    const upperTicker = ticker.toUpperCase();
    const data = await getHistorical(upperTicker, period);
    
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      displayHistoricalTable(data, upperTicker, options.all);
    }
  });

program.parse();