#!/usr/bin/env node

const { program } = require('commander');
const Table = require('cli-table3');
const https = require('https');
const fs = require('fs');

// Simple fetch wrapper
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Parse tickers from string
function parseTickers(input) {
  if (!input) return [];
  return input
    .split(/[,\n]/)
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
}

// Format helpers
function formatNum(n) {
  if (n === null || n === undefined) return 'N/A';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n) {
  if (n === null || n === undefined) return 'N/A';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

// Get quote data - using chart endpoint for quote too
async function getQuote(ticker) {
  try {
    // Use chart endpoint with 1d range - gives us current price info
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`;
    const data = await fetch(url);
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return { symbol: ticker, error: 'Ticker not found' };
    }
    
    const result = data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    
    if (!meta) {
      return { symbol: ticker, error: 'No data available' };
    }
    
    // Get previous close from 5d chart
    const prevUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`;
    const prevData = await fetch(prevUrl);
    let prevClose = null;
    if (prevData.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
      const closes = prevData.chart.result[0].indicators.quote[0].close;
      // Find the second to last close that's not null
      for (let i = closes.length - 2; i >= 0; i--) {
        if (closes[i] !== null) {
          prevClose = closes[i];
          break;
        }
      }
    }
    
    const currentPrice = meta.regularMarketPrice || meta.previousClose;
    const change = prevClose ? currentPrice - prevClose : null;
    const changePct = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : null;
    
    return {
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      price: currentPrice,
      change: change,
      changePct: changePct,
      open: meta.chartPreviousClose || meta.previousClose,
      high: meta.regularMarketDayHigh || meta.dayHigh,
      low: meta.regularMarketDayLow || meta.dayLow,
      volume: meta.regularMarketVolume,
      marketCap: null, // Not available in chart endpoint
      peRatio: null,
      previousClose: prevClose || meta.previousClose,
      exchange: meta.exchangeName,
    };
  } catch (err) {
    return { symbol: ticker, error: err.message };
  }
}

// Get historical data
async function getHistorical(ticker, period) {
  try {
    let url;
    const dateRangeMatch = period.match(/^(\d{8})-(\d{8})$/);
    
    if (dateRangeMatch) {
      const parseDate = (d) => {
        const day = d.slice(0, 2);
        const month = d.slice(2, 4);
        const year = d.slice(4, 8);
        return new Date(`${year}-${month}-${day}`).getTime() / 1000;
      };
      const period1 = parseDate(dateRangeMatch[1]);
      const period2 = parseDate(dateRangeMatch[2]);
      url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
    } else {
      const periodMap = {
        '1d': '1d', '5d': '5d', '1mo': '1mo', '3mo': '3mo',
        '6mo': '6mo', '1y': '1y', '2y': '2y', '5y': '5y',
        '10y': '10y', 'ytd': 'ytd', 'max': 'max',
      };
      
      if (!periodMap[period]) {
        throw new Error(`Invalid period. Use: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max, or DDMMYYYY-DDMMYYYY`);
      }
      
      url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?range=${periodMap[period]}&interval=1d`;
    }
    
    const data = await fetch(url);
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return { symbol: ticker, error: 'No data found' };
    }
    
    return parseChartData(data, ticker);
  } catch (err) {
    return { symbol: ticker, error: err.message };
  }
}

function parseChartData(data, ticker) {
  if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
    return { symbol: ticker, error: 'No data found' };
  }
  
  const result = data.chart.result[0];
  const timestamps = result.timestamp;
  const indicators = result.indicators;
  
  if (!timestamps || !indicators || !indicators.quote || !indicators.quote[0]) {
    return { symbol: ticker, error: 'No data available' };
  }
  
  const quote = indicators.quote[0];
  const adjClose = indicators.adjclose?.[0]?.adjclose;
  
  return timestamps.map((ts, i) => ({
    date: formatDate(new Date(ts * 1000)),
    open: quote.open[i],
    high: quote.high[i],
    low: quote.low[i],
    close: quote.close[i],
    adjClose: adjClose ? adjClose[i] : quote.close[i],
    volume: quote.volume[i],
  })).filter(h => h.close !== null);
}

// Display functions
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

  const details = new Table({ chars: { top: '', 'top-mid': '', 'top-left': '', 'top-right': '', bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '', left: '', 'left-mid': '', mid: '', 'mid-mid': '', right: '', 'right-mid': '', dash: '', 'dash-mid': '', 'dash-left': '', 'dash-right': '', space: '' } });
  
  details.push(
    ['Open', data.open ? formatNum(data.open) : 'N/A'],
    ['Prev Close', data.previousClose ? formatNum(data.previousClose) : 'N/A'],
    ['Day High', data.high ? formatNum(data.high) : 'N/A'],
    ['Day Low', data.low ? formatNum(data.low) : 'N/A'],
    ['Exchange', data.exchange || 'N/A'],
  );
  
  console.log(details.toString());
}

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

// Main CLI
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
  .argument('<file>', 'Path to CSV file')
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
