let data = [];
let chartInstances = {};
let forecastModel = null;
let modelMetrics = {};

// ============= DATA MANAGEMENT =============
document.getElementById('load-sample').addEventListener('click', () => {
    data = JSON.parse(JSON.stringify(sampleData));
    showMessage('Sample data loaded successfully!', 'success');
    updateDataList();
    updateDashboard();
});

document.getElementById('manual-input').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const year = parseInt(document.getElementById('year').value);
    const month = document.getElementById('month').value ? parseInt(document.getElementById('month').value) : null;
    const emission = parseFloat(document.getElementById('emission').value);
    const category = document.getElementById('category').value;
    const source = document.getElementById('source').value || 'Unknown';
    
    // Validate
    const errors = validateDataEntry(year, emission, category);
    if (errors.length > 0) {
        showMessage('Validation errors: ' + errors.join('; '), 'error');
        return;
    }
    
    data.push({ year, month: month || undefined, emission, category, source });
    showMessage('Data entry added successfully!', 'success');
    updateDataList();
    updateDashboard();
    e.target.reset();
});

document.getElementById('apply-filters').addEventListener('click', () => {
    const filterCategory = document.getElementById('filter-category').value.toLowerCase();
    const filterYear = document.getElementById('filter-year').value;
    
    let filtered = data;
    if (filterCategory) filtered = filtered.filter(d => d.category.toLowerCase().includes(filterCategory));
    if (filterYear) filtered = filtered.filter(d => d.year === parseInt(filterYear));
    
    displayFilteredData(filtered);
});

function displayFilteredData(filteredData) {
    const list = document.getElementById('data-list');
    list.innerHTML = filteredData.map((d, idx) => 
        `<li>
            <strong>${d.year}${d.month ? '-' + d.month : ''}</strong> | 
            ${d.emission.toFixed(2)} kg | 
            ${d.category} from ${d.source}
            <button class="delete-btn" onclick="deleteDataPoint(${data.indexOf(d)})" style="float:right; background:#dc2626; padding:5px 10px; color:white; border:none; border-radius:4px; cursor:pointer;">✕</button>
        </li>`
    ).join('');
}

function updateDataList() {
    document.getElementById('entry-count').textContent = data.length;
    displayFilteredData(data);
}

function deleteDataPoint(index) {
    data.splice(index, 1);
    updateDataList();
    updateDashboard();
}

// ============= EXPORT FUNCTIONS =============
document.getElementById('export-csv').addEventListener('click', () => {
    if (data.length === 0) {
        showMessage('No data to export!', 'warning');
        return;
    }
    
    let csv = 'Year,Month,Consumption (kg),Category,Source\n';
    data.forEach(d => {
        csv += `${d.year},${d.month || ''},${d.emission},${d.category},${d.source}\n`;
    });
    
    downloadFile(csv, 'consumption-data.csv', 'text/csv');
});

document.getElementById('export-json').addEventListener('click', () => {
    if (data.length === 0) {
        showMessage('No data to export!', 'warning');
        return;
    }
    
    const enrichedData = data.map(d => ({
        ...d,
        emission_kg: d.emission
    }));
    
    const json = JSON.stringify(enrichedData, null, 2);
    downloadFile(json, 'consumption-data.json', 'application/json');
});

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage(`${filename} exported successfully!`, 'success');
}

document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        data = [];
        updateDataList();
        updateDashboard();
        updateAnalytics();
        showMessage('All data cleared!', 'info');
    }
});

// ============= DASHBOARD =============
function updateDashboard() {
    if (data.length === 0) {
        document.getElementById('total-emissions').textContent = '--';
        document.getElementById('yoy-change').textContent = '--';
        document.getElementById('avg-growth').textContent = '--';
        document.getElementById('data-points').textContent = '0';
        return;
    }
    
    const stats = calculateStatistics(data);
    document.getElementById('total-emissions').textContent = stats.totalEmissions.toFixed(2);
    document.getElementById('yoy-change').textContent = stats.yoyChange.toFixed(2);
    document.getElementById('avg-growth').textContent = (stats.totalGrowthRate / (stats.yearsInData - 1 || 1)).toFixed(2);
    document.getElementById('data-points').textContent = data.length;
    
    // Draw dashboard charts
    drawDashboardTrendChart(stats.yearlyEmissions);
    drawDashboardIndustryChart();
    drawGasPieChart();
    drawPeriodComparisonTable(stats.yearlyEmissions);
}

function drawDashboardTrendChart(yearlyEmissions) {
    const ctx = document.getElementById('dashboard-trend').getContext('2d');
    
    if (chartInstances['dashboard-trend']) {
        chartInstances['dashboard-trend'].destroy();
    }
    
    chartInstances['dashboard-trend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: yearlyEmissions.map(d => d.year),
            datasets: [{
                label: 'Total Consumption (kg)',
                data: yearlyEmissions.map(d => d.total.toFixed(2)),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: '#e2e8f0' } } },
            scales: {
                y: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } },
                x: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } }
            }
        }
    });
}

function drawDashboardIndustryChart() {
    const categories = [...new Set(data.map(d => d.category))];
    const categoryData = categories.map(category => ({
        category,
        total: data.filter(d => d.category === category)
                   .reduce((sum, d) => sum + d.emission, 0)
    }));
    
    const ctx = document.getElementById('dashboard-industry').getContext('2d');
    if (chartInstances['dashboard-industry']) {
        chartInstances['dashboard-industry'].destroy();
    }
    
    chartInstances['dashboard-industry'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categoryData.map(d => d.category),
            datasets: [{
                data: categoryData.map(d => d.total.toFixed(2)),
                backgroundColor: ['#667eea', '#764ba2', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'],
                borderColor: '#1a202c',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#e2e8f0' } } }
        }
    });
}

function drawGasPieChart() {
    const categories = [...new Set(data.map(d => d.category))];
    const categoryData = categories.map(category => ({
        category,
        total: data.filter(d => d.category === category)
                   .reduce((sum, d) => sum + d.emission, 0)
    }));
    
    const ctx = document.getElementById('dashboard-gas-pie').getContext('2d');
    if (chartInstances['dashboard-gas-pie']) {
        chartInstances['dashboard-gas-pie'].destroy();
    }
    
    chartInstances['dashboard-gas-pie'] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categoryData.map(d => d.category),
            datasets: [{
                data: categoryData.map(d => d.total.toFixed(2)),
                backgroundColor: ['#667eea', '#764ba2', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'],
                borderColor: '#1a202c',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#e2e8f0' } } }
        }
    });
}

function drawPeriodComparisonTable(yearlyEmissions) {
    if (!yearlyEmissions || yearlyEmissions.length === 0) return;
    
    const tbody = document.querySelector('#period-comparison-table tbody');
    tbody.innerHTML = yearlyEmissions.map((d, idx) => {
        let yoyChange = 'N/A';
        if (idx > 0) {
            const prev = yearlyEmissions[idx - 1].total;
            yoyChange = (((d.total - prev) / prev) * 100).toFixed(2) + '%';
        }
        
        let growth = 'N/A';
        if (idx > 0) {
            const start = yearlyEmissions[0].total;
            growth = (((d.total - start) / start) * 100).toFixed(2) + '%';
        }
        
        return `<tr>
            <td>${d.year}</td>
            <td>${d.total.toFixed(2)}</td>
            <td>${yoyChange}</td>
            <td>${growth}</td>
        </tr>`;
    }).join('');
}

// ============= FORECASTING =============
document.getElementById('train-forecast').addEventListener('click', async () => {
    if (data.length < 3) {
        showMessage('Need at least 3 data points to forecast!', 'warning');
        return;
    }
    
    const statusDiv = document.getElementById('forecast-status');
    statusDiv.classList.add('show', 'info');
    statusDiv.textContent = 'Training model... This may take a moment.';
    
    try {
        const forecastYears = parseInt(document.getElementById('forecast-years').value);
        const modelType = document.getElementById('forecast-model').value;
        
        const stats = calculateStatistics(data);
        const yearlyEmissions = stats.yearlyEmissions;
        
        let forecasts, confidenceIntervals, optimistic, pessimistic;
        
        if (modelType === 'lstm') {
            ({ forecasts, confidenceIntervals, optimistic, pessimistic } 
                = await trainLSTMModel(yearlyEmissions, forecastYears));
        } else if (modelType === 'arima') {
            ({ forecasts, confidenceIntervals, optimistic, pessimistic } 
                = arimaForecast(yearlyEmissions, forecastYears));
        } else {
            ({ forecasts, confidenceIntervals, optimistic, pessimistic } 
                = linearRegression(yearlyEmissions, forecastYears));
        }
        
        const lastYear = yearlyEmissions[yearlyEmissions.length - 1].year;
        const forecastYearsArray = Array.from({length: forecastYears}, (_, i) => lastYear + i + 1);
        
        drawForecastChart(yearlyEmissions, forecastYearsArray, forecasts);
        drawScenarioChart(yearlyEmissions, forecastYearsArray, forecasts, optimistic, pessimistic);
        drawForecastTable(forecastYearsArray, forecasts, confidenceIntervals, optimistic, pessimistic);
        updateMetrics(yearlyEmissions, forecasts, modelType);
        
        statusDiv.classList.remove('info');
        statusDiv.classList.add('success');
        statusDiv.textContent = `Forecast completed using ${modelType.toUpperCase()} model!`;
        
    } catch (error) {
        statusDiv.classList.remove('info');
        statusDiv.classList.add('error');
        statusDiv.textContent = 'Forecasting error: ' + error.message;
    }
});

async function trainLSTMModel(yearlyEmissions, forecastYears) {
    const emissions = yearlyEmissions.map(d => d.total);
    const minEmission = Math.min(...emissions);
    const maxEmission = Math.max(...emissions);
    const normalized = emissions.map(e => (e - minEmission) / (maxEmission - minEmission || 1));
    
    // Create sequences
    const sequences = [];
    for (let i = 0; i < normalized.length - 2; i++) {
        sequences.push(normalized.slice(i, i + 3));
    }
    
    if (sequences.length === 0) {
        return arimaForecast(yearlyEmissions, forecastYears);
    }
    
    const targets = normalized.slice(2);
    
    // Build LSTM model
    const model = tf.sequential({
        layers: [
            tf.layers.lstm({ units: 16, inputShape: [3, 1], returnSequences: false }),
            tf.layers.dense({ units: 8, activation: 'relu' }),
            tf.layers.dense({ units: 1 })
        ]
    });
    
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    
    const xs = tf.tensor3d(sequences.map(s => s.map(v => [v])));
    const ys = tf.tensor1d(targets);
    
    await model.fit(xs, ys, { epochs: 50, verbose: 0 });
    
    // Forecast
    let sequence = normalized.slice(-3);
    const forecasts = [];
    
    for (let i = 0; i < forecastYears; i++) {
        const input = tf.tensor3d([sequence.map(v => [v])]);
        const pred = model.predict(input);
        const predVal = pred.dataSync()[0];
        forecasts.push(predVal * (maxEmission - minEmission) + minEmission);
        
        sequence = [sequence[1], sequence[2], predVal];
        input.dispose();
        pred.dispose();
    }
    
    // Calculate confidence intervals
    const residuals = normalized.map((val, i) => {
        if (i < 2) return 0;
        return targets[i - 2] - val;
    });
    
    const stdDev = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length);
    const confidenceIntervals = forecasts.map(f => ({
        lower: Math.max(0, f - 1.96 * stdDev * (maxEmission - minEmission)),
        upper: f + 1.96 * stdDev * (maxEmission - minEmission)
    }));
    
    const optimistic = forecasts.map(f => f * 0.95);
    const pessimistic = forecasts.map(f => f * 1.05);
    
    tf.dispose([xs, ys]);
    model.dispose();
    
    return { forecasts, confidenceIntervals, optimistic, pessimistic };
}

function arimaForecast(yearlyEmissions, forecastYears) {
    const emissions = yearlyEmissions.map(d => d.total);
    
    // Simple exponential smoothing
    const alpha = 0.3;
    let smoothed = emissions[0];
    const forecasts = [];
    
    for (let i = 0; i < forecastYears; i++) {
        forecasts.push(smoothed);
        if (i < emissions.length - 1) {
            smoothed = alpha * emissions[i + 1] + (1 - alpha) * smoothed;
        }
    }
    
    const trend = (emissions[emissions.length - 1] - emissions[0]) / emissions.length;
    const adjustedForecasts = forecasts.map((f, i) => f + trend * (i + 1));
    
    const variance = emissions.reduce((sum, e) => sum + Math.pow(e - (adjustedForecasts[0] || e), 2), 0) / emissions.length;
    const stdDev = Math.sqrt(variance);
    
    const confidenceIntervals = adjustedForecasts.map(f => ({
        lower: Math.max(0, f - 1.96 * stdDev),
        upper: f + 1.96 * stdDev
    }));
    
    const optimistic = adjustedForecasts.map(f => f * 0.92);
    const pessimistic = adjustedForecasts.map(f => f * 1.08);
    
    return { forecasts: adjustedForecasts, confidenceIntervals, optimistic, pessimistic };
}

function linearRegression(yearlyEmissions, forecastYears) {
    const emissions = yearlyEmissions.map(d => d.total);
    const n = emissions.length;
    const x = Array.from({length: n}, (_, i) => i);
    
    const summaryX = x.reduce((a, b) => a + b);
    const summaryY = emissions.reduce((a, b) => a + b);
    const summaryXY = x.reduce((sum, xi, i) => sum + xi * emissions[i], 0);
    const summaryX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * summaryXY - summaryX * summaryY) / (n * summaryX2 - summaryX * summaryX);
    const intercept = (summaryY - slope * summaryX) / n;
    
    const forecasts = Array.from({length: forecastYears}, (_, i) => 
        Math.max(0, slope * (n + i) + intercept)
    );
    
    const residuals = emissions.map((e, i) => e - (slope * i + intercept));
    const variance = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
    const stdDev = Math.sqrt(variance);
    
    const confidenceIntervals = forecasts.map(f => ({
        lower: Math.max(0, f - 1.96 * stdDev),
        upper: f + 1.96 * stdDev
    }));
    
    const optimistic = forecasts.map(f => f * 0.90);
    const pessimistic = forecasts.map(f => f * 1.10);
    
    return { forecasts, confidenceIntervals, optimistic, pessimistic };
}

function drawForecastChart(yearlyEmissions, forecastYearsArray, forecasts) {
    const years = yearlyEmissions.map(d => d.year);
    const emissions = yearlyEmissions.map(d => d.total);
    
    const ctx = document.getElementById('forecast-chart').getContext('2d');
    if (chartInstances['forecast-chart']) {
        chartInstances['forecast-chart'].destroy();
    }
    
    chartInstances['forecast-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...years, ...forecastYearsArray],
            datasets: [{
                label: 'Historical Data (kg)',
                data: emissions.map(e => e.toFixed(2)),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 4
            }, {
                label: 'Forecast (kg)',
                data: [...Array(years.length).fill(null), ...forecasts.map(f => f.toFixed(2))],
                borderColor: '#f59e0b',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#e2e8f0' } } },
            scales: {
                y: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } },
                x: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } }
            }
        }
    });
}

function drawScenarioChart(yearlyEmissions, forecastYearsArray, baseline, optimistic, pessimistic) {
    const years = yearlyEmissions.map(d => d.year);
    
    const ctx = document.getElementById('scenario-chart').getContext('2d');
    if (chartInstances['scenario-chart']) {
        chartInstances['scenario-chart'].destroy();
    }
    
    chartInstances['scenario-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...years, ...forecastYearsArray],
            datasets: [{
                label: 'Baseline',
                data: [...Array(years.length).fill(null), ...baseline.map(f => f.toFixed(2))],
                borderColor: '#667eea',
                borderWidth: 3,
                fill: false
            }, {
                label: 'Optimistic',
                data: [...Array(years.length).fill(null), ...optimistic.map(f => f.toFixed(2))],
                borderColor: '#10b981',
                borderDash: [3, 3],
                fill: false
            }, {
                label: 'Pessimistic',
                data: [...Array(years.length).fill(null), ...pessimistic.map(f => f.toFixed(2))],
                borderColor: '#ef4444',
                borderDash: [3, 3],
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#e2e8f0' } } },
            scales: {
                y: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } },
                x: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } }
            }
        }
    });
}

function drawForecastTable(forecastYearsArray, forecasts, confidenceIntervals, optimistic, pessimistic) {
    const tbody = document.querySelector('#forecast-table tbody');
    
    tbody.innerHTML = forecastYearsArray.map((year, idx) => `<tr>
        <td>${year}</td>
        <td>${forecasts[idx].toFixed(2)}</td>
        <td>${confidenceIntervals[idx].lower.toFixed(2)}</td>
        <td>${confidenceIntervals[idx].upper.toFixed(2)}</td>
        <td>${optimistic[idx].toFixed(2)}</td>
        <td>${pessimistic[idx].toFixed(2)}</td>
    </tr>`).join('');
}

function updateMetrics(yearlyEmissions, forecasts, modelType) {
    const emissions = yearlyEmissions.map(d => d.total);
    
    // Calculate predicted values for historical data
    let predictions = [];
    const n = emissions.length;
    
    if (modelType === 'linear') {
        // Linear regression predictions
        const x = Array.from({length: n}, (_, i) => i);
        const summaryX = x.reduce((a, b) => a + b);
        const summaryY = emissions.reduce((a, b) => a + b);
        const summaryXY = x.reduce((sum, xi, i) => sum + xi * emissions[i], 0);
        const summaryX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * summaryXY - summaryX * summaryY) / (n * summaryX2 - summaryX * summaryX);
        const intercept = (summaryY - slope * summaryX) / n;
        
        predictions = x.map(xi => slope * xi + intercept);
    } else {
        // For LSTM and ARIMA, use exponential smoothing approximation
        const alpha = 0.3;
        let smoothed = emissions[0];
        predictions.push(smoothed);
        
        for (let i = 1; i < emissions.length; i++) {
            smoothed = alpha * emissions[i] + (1 - alpha) * smoothed;
            predictions.push(smoothed);
        }
    }
    
    // Calculate R² Score
    const meanEmission = emissions.reduce((a, b) => a + b) / n;
    const ssTotal = emissions.reduce((sum, e) => sum + Math.pow(e - meanEmission, 2), 0);
    const ssRes = emissions.reduce((sum, e, i) => sum + Math.pow(e - predictions[i], 2), 0);
    const r2Score = 1 - (ssRes / ssTotal);
    
    // Calculate RMSE
    const rmse = Math.sqrt(emissions.reduce((sum, e, i) => sum + Math.pow(e - predictions[i], 2), 0) / n);
    
    // Calculate MAE
    const mae = emissions.reduce((sum, e, i) => sum + Math.abs(e - predictions[i]), 0) / n;
    
    // Calculate Trend Direction
    const firstValue = emissions[0];
    const lastValue = emissions[n - 1];
    const trendDirection = lastValue > firstValue ? '📈 Increasing' : (lastValue < firstValue ? '📉 Decreasing' : '➡️ Stable');
    
    // Update UI
    document.getElementById('r2-score').textContent = r2Score.toFixed(3);
    document.getElementById('rmse').textContent = rmse.toFixed(2);
    document.getElementById('mae').textContent = mae.toFixed(2);
    document.getElementById('trend-direction').textContent = trendDirection;
}

// ============= UTILITIES =============
function showMessage(message, type) {
    const msgElement = document.getElementById('validation-message');
    msgElement.textContent = message;
    msgElement.className = `validation-msg show ${type}`;
    
    setTimeout(() => {
        msgElement.classList.remove('show');
    }, 4000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Single page layout - all content visible
});
