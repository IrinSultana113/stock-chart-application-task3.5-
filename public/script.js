let stockChart = null;
let currentSymbol = '';
let currentRange = '1d';

document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('loadBtn');
    const stockSearch = document.getElementById('stockSearch');
    const stockList = document.getElementById('stockList');
    const rangeButtons = document.querySelectorAll('.range-btn');
    const controlsEl = document.getElementById('chartControls');

    // প্রথম অবস্থায় কন্ট্রোল বাটনগুলো হাইড থাকবে যতক্ষণ না সার্চ করা হয়
    controlsEl.style.display = 'none';

    let debounceTimer;

    // অটোকমপ্লিট সার্চ ইনপুট হ্যান্ডলার
    stockSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 1) {
            stockList.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const stocks = await res.json();
                
                stockList.innerHTML = '';
                stocks.forEach(stock => {
                    const option = document.createElement('option');
                    option.value = stock.symbol;
                    option.textContent = `${stock.symbol} - ${stock.name}`;
                    stockList.appendChild(option);
                });
            } catch (err) {
                console.error('Autocomplete error:', err);
            }
        }, 300);
    });

    // চার্ট লোড করার বাটন ইভেন্ট
    loadBtn.addEventListener('click', () => {
        const val = stockSearch.value.trim().split(' ')[0];
        if (val) {
            currentSymbol = val.toUpperCase();
            controlsEl.style.display = 'flex';
            fetchStockData(currentSymbol, currentRange);
        } else {
            alert('Please select or enter a stock symbol.');
        }
    });

    stockSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadBtn.click();
        }
    });

    // টাইম রেঞ্জ বাটন ইভেন্ট (1d, 5d, 1w, 1m, 1y)
    rangeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            rangeButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentRange = e.target.getAttribute('data-range');
            if (currentSymbol) {
                fetchStockData(currentSymbol, currentRange);
            }
        });
    });
});

async function fetchStockData(symbol, range) {
    const loadingEl = document.getElementById('loading');
    loadingEl.style.display = 'block';

    try {
        const response = await fetch(`/api/stock/${symbol}?range=${range}`);
        const result = await response.json();

        if (result.success) {
            renderChart(result.symbol, result.data);
        } else {
            alert(result.error || 'Failed to fetch stock data.');
        }
    } catch (error) {
        console.error('Error fetching stock data:', error);
        alert('Network error while fetching stock data.');
    } finally {
        loadingEl.style.display = 'none';
    }
}

function renderChart(symbol, dataPoints) {
    const ctx = document.getElementById('stockChart').getContext('2d');

    const labels = dataPoints.map(d => d.x);
    const values = dataPoints.map(d => d.y);

    if (stockChart) {
        stockChart.destroy();
    }

    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol} Stock Price ($)`,
                data: values,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointRadius: dataPoints.length > 50 ? 0 : 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: '#f1f5f9'
                    }
                }
            }
        }
    });
}