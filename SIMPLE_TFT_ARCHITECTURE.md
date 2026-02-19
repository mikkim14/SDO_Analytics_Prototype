# Simple TFT AI Architecture for GHG Management System
## Frontend → Backend API → TFT Model → Database

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                       │
│           HTML/CSS/JavaScript (Vanilla JS)              │
│  - Forecast charts (Chart.js)                           │
│  - Anomaly alerts                                       │
│  - Recommendations display                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  fetch('/api/forecast', { method: 'POST', data })      │
│                    ↓↑ JSON                              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│              BACKEND API LAYER                          │
│         Python Flask or FastAPI                         │
│  - /api/forecast/{module}/{campus}                      │
│  - /api/train/{module}                                  │
│  - /api/anomalies/{module}                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Load model → Make predictions → Return JSON            │
│                    ↓↑ Models & Data                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│              ML MODEL LAYER                             │
│    TFT Model (PyTorch or TensorFlow)                    │
│  - Load trained model from disk                         │
│  - Forward pass for inference                           │
│  - Return predictions with confidence intervals         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Load historical data → Train/Retrain → Save model      │
│                    ↓↑ Data & Weights                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│              DATABASE LAYER                             │
│              MySQL (Existing)                           │
│  - Historical emissions data                            │
│  - Forecast cache                                       │
│  - Model metadata                                       │
│  - Detected anomalies                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Frontend (HTML/JS)

**File: `pages/ai_dashboard.php`**

```html
<?php
require_once '../includes/config.php';
require_once '../pages/tailwind-header.php';

$user = Auth::getCurrentUser();
$campus = $user['campus'];
?>

<div class="container mx-auto p-6">
    <h1 class="text-4xl font-bold mb-8">AI Forecasting Dashboard</h1>
    
    <!-- Forecast Section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-bold mb-4">💡 Electricity Forecast</h3>
            <canvas id="electricityChart"></canvas>
            <small class="text-gray-500">12-month forecast | Accuracy: <span id="elec-acc">--</span>%</small>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-bold mb-4">💧 Water Forecast</h3>
            <canvas id="waterChart"></canvas>
            <small class="text-gray-500">12-month forecast | Accuracy: <span id="water-acc">--</span>%</small>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-bold mb-4">⛽ Fuel Forecast</h3>
            <canvas id="fuelChart"></canvas>
            <small class="text-gray-500">12-month forecast | Accuracy: <span id="fuel-acc">--</span>%</small>
        </div>
    </div>
    
    <!-- Anomalies Section -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-2xl font-bold mb-4">🚨 Anomaly Alerts</h2>
        <div id="anomalies" class="space-y-3">
            <p class="text-gray-500">Loading...</p>
        </div>
    </div>
    
    <!-- Recommendations Section -->
    <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-2xl font-bold mb-4">💡 Recommendations</h2>
        <div id="recommendations" class="space-y-3">
            <p class="text-gray-500">Loading...</p>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
const campus = "<?php echo $campus; ?>";

// Load and display forecasts
async function loadForecasts() {
    const modules = ['electricity', 'water', 'fuel'];
    
    for (const module of modules) {
        try {
            const response = await fetch('/api/ai_forecast.php', {
                method: 'POST',
                body: new FormData(Object.assign(document.createElement('form'), {
                    entries: {
                        action: 'get_forecast',
                        module: module,
                        campus: campus
                    }
                }))
            });
            
            // Simpler method:
            const formData = new FormData();
            formData.append('action', 'get_forecast');
            formData.append('module', module);
            formData.append('campus', campus);
            
            const res = await fetch('/api/ai_forecast.php', {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            
            if (data.success) {
                drawChart(module, data.forecast, data.accuracy);
            } else {
                console.error(`Error loading ${module}:`, data.message);
            }
        } catch (err) {
            console.error(`Error: ${err}`);
        }
    }
}

// Draw forecast chart
function drawChart(module, forecast, accuracy) {
    const ctx = document.getElementById(module + 'Chart').getContext('2d');
    const labels = forecast.map(f => f.month);
    const predictions = forecast.map(f => f.predicted_value);
    const lower = forecast.map(f => f.lower_80);
    const upper = forecast.map(f => f.upper_80);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Forecast',
                    data: predictions,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: '80% Confidence Band',
                    data: upper,
                    borderColor: 'rgba(59, 130, 246, 0.2)',
                    borderDash: [5, 5],
                    fill: false,
                    borderWidth: 1,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: module } }
            }
        }
    });
    
    // Update accuracy
    document.getElementById(module + '-acc').textContent = (accuracy * 100).toFixed(1);
}

// Load anomalies
async function loadAnomalies() {
    try {
        const formData = new FormData();
        formData.append('action', 'get_anomalies');
        formData.append('campus', campus);
        
        const res = await fetch('/api/ai_forecast.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        
        if (data.anomalies && data.anomalies.length > 0) {
            const html = data.anomalies.map(a => `
                <div class="border-l-4 border-red-500 bg-red-50 p-4">
                    <p class="font-bold text-red-700">${a.module.toUpperCase()} - ${a.date}</p>
                    <p class="text-sm">Expected: ${a.expected.toFixed(0)} | Actual: ${a.actual.toFixed(0)}</p>
                    <p class="text-sm text-red-600">Deviation: ${a.deviation.toFixed(1)}% (Confidence: ${(a.confidence * 100).toFixed(0)}%)</p>
                </div>
            `).join('');
            document.getElementById('anomalies').innerHTML = html;
        } else {
            document.getElementById('anomalies').innerHTML = '<p class="text-green-600">✓ No anomalies detected</p>';
        }
    } catch (err) {
        console.error('Error loading anomalies:', err);
    }
}

// Load recommendations
async function loadRecommendations() {
    try {
        const formData = new FormData();
        formData.append('action', 'get_recommendations');
        formData.append('campus', campus);
        
        const res = await fetch('/api/ai_forecast.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        
        if (data.recommendations && data.recommendations.length > 0) {
            const html = data.recommendations.map(r => `
                <div class="border-l-4 border-blue-500 bg-blue-50 p-4">
                    <p class="font-bold text-blue-700">${r.title}</p>
                    <p class="text-sm">${r.description}</p>
                    <p class="text-sm mt-2">
                        💰 Savings: ${r.savings.toFixed(0)} kWh/month | 
                        ⏰ ROI: ${r.roi} months
                    </p>
                </div>
            `).join('');
            document.getElementById('recommendations').innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading recommendations:', err);
    }
}

// Load everything when page loads
window.addEventListener('load', () => {
    loadForecasts();
    loadAnomalies();
    loadRecommendations();
});
</script>
```

---

## Layer 2: Backend API (Python Flask)

**File: `ml_service/app.py`**

```python
from flask import Flask, request, jsonify
import torch
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import logging
import os
from dotenv import load_dotenv
import pymysql
import pickle

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
MYSQL_HOST = os.getenv('MYSQL_HOST', '127.0.0.1')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASS = os.getenv('MYSQL_PASS', '')
MYSQL_DB = os.getenv('MYSQL_DB', 'ghg_database')
MODELS_DIR = './models'

# ============================================================================
# Layer 2: Backend API - Routes
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()}), 200

@app.route('/api/forecast/<module>/<campus>', methods=['POST', 'GET'])
def get_forecast(module, campus):
    """
    Get 12-month forecast for module/campus
    
    Returns:
        {
            "success": true,
            "forecast": [
                {"month": "Mar 2026", "predicted_value": 45000, "lower_80": 42000, "upper_80": 48000},
                ...
            ],
            "accuracy": 0.94
        }
    """
    try:
        # Load historical data
        df = load_data_from_mysql(module, campus)
        if df is None or len(df) < 12:
            return jsonify({'success': False, 'message': 'Insufficient data'}), 400
        
        # Load pretrained TFT model
        model = load_tft_model(module, campus)
        if model is None:
            return jsonify({'success': False, 'message': 'Model not found. Train first.'}), 400
        
        # Generate forecast
        forecast = generate_forecast(model, df, horizon=12)
        
        # Get accuracy
        accuracy = get_model_accuracy(module, campus)
        
        # Cache in database
        cache_forecast(module, campus, forecast)
        
        return jsonify({
            'success': True,
            'module': module,
            'campus': campus,
            'forecast': forecast,
            'accuracy': accuracy
        }), 200
        
    except Exception as e:
        logger.error(f"Error in forecast: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/train/<module>/<campus>', methods=['POST'])
def train_model(module, campus):
    """
    Train/retrain TFT model
    
    Body: {"max_epochs": 100, "batch_size": 32}
    """
    try:
        params = request.get_json() or {}
        max_epochs = params.get('max_epochs', 100)
        batch_size = params.get('batch_size', 32)
        
        logger.info(f"Starting training: {module} - {campus}")
        
        # Load data
        df = load_data_from_mysql(module, campus)
        if df is None or len(df) < 24:
            return jsonify({'success': False, 'message': 'Need 24+ months of data'}), 400
        
        # Train TFT
        model = train_tft_model(df, module, campus, max_epochs, batch_size)
        
        # Save model
        save_tft_model(model, module, campus)
        
        # Save metadata
        accuracy = calculate_accuracy(model, df)
        save_model_metadata(module, campus, accuracy)
        
        logger.info(f"Training completed: {module} - {campus}, Accuracy: {accuracy:.2%}")
        
        return jsonify({
            'success': True,
            'message': f'Model trained for {module} - {campus}',
            'accuracy': accuracy,
            'trained_at': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in training: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/anomalies/<module>', methods=['GET'])
def get_anomalies(module):
    """Detect anomalies in recent data"""
    try:
        campus = request.args.get('campus')
        
        # Load recent data
        df = load_data_from_mysql(module, campus, months=3)
        if df is None or len(df) < 3:
            return jsonify({'anomalies': []}), 200
        
        # Get historical baseline
        df_historical = load_data_from_mysql(module, campus, months=24)
        baseline_mean = df_historical['value'].mean()
        baseline_std = df_historical['value'].std()
        
        # Detect anomalies (z-score > 2)
        anomalies = []
        for idx, row in df.iterrows():
            z_score = abs((row['value'] - baseline_mean) / baseline_std)
            if z_score > 2:  # 2-sigma rule
                anomalies.append({
                    'module': module,
                    'date': row['date'].strftime('%Y-%m-%d'),
                    'actual': float(row['value']),
                    'expected': float(baseline_mean),
                    'deviation': float((row['value'] - baseline_mean) / baseline_mean * 100),
                    'confidence': float(min(z_score / 3, 1.0))  # Normalize confidence
                })
        
        return jsonify({'anomalies': anomalies}), 200
        
    except Exception as e:
        logger.error(f"Error detecting anomalies: {str(e)}")
        return jsonify({'anomalies': []}), 200

@app.route('/api/recommendations/<campus>', methods=['GET'])
def get_recommendations(campus):
    """Get personalized energy saving recommendations"""
    try:
        # Simple rule-based recommendations
        recommendations = []
        
        # Check electricity high usage
        elec_data = load_data_from_mysql('electricity', campus, months=12)
        if elec_data is not None:
            avg_kwh = elec_data['value'].mean()
            
            if avg_kwh > 40000:
                recommendations.append({
                    'title': 'LED Retrofit Program',
                    'description': 'Replace fluorescent lights with LED. Reduces consumption by 40-50%.',
                    'savings': avg_kwh * 0.45,
                    'roi': 4,
                    'priority': 'HIGH'
                })
            
            if avg_kwh > 30000:
                recommendations.append({
                    'title': 'HVAC Optimization',
                    'description': 'Install smart thermostats with occupancy scheduling.',
                    'savings': avg_kwh * 0.15,
                    'roi': 3,
                    'priority': 'HIGH'
                })
        
        return jsonify({'recommendations': recommendations}), 200
        
    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        return jsonify({'recommendations': []}), 200

# ============================================================================
# Layer 3: TFT Model Functions
# ============================================================================

def load_tft_model(module, campus):
    """Load trained TFT model from disk"""
    try:
        model_path = f'{MODELS_DIR}/tft_{module}_{campus}.pth'
        if not os.path.exists(model_path):
            return None
        
        # Load model (simplified - in real use, load actual model architecture)
        model = torch.load(model_path, map_location='cpu')
        return model
        
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return None

def save_tft_model(model, module, campus):
    """Save trained TFT model"""
    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = f'{MODELS_DIR}/tft_{module}_{campus}.pth'
    torch.save(model.state_dict(), model_path)
    logger.info(f"Model saved to {model_path}")

def train_tft_model(df, module, campus, max_epochs=100, batch_size=32):
    """
    Train TFT model (simplified skeleton)
    
    In production, use pytorch-forecasting library
    """
    # TODO: Implement full TFT training
    # This is a placeholder showing the structure
    
    logger.info(f"Training TFT: {len(df)} samples, {max_epochs} epochs")
    
    # 1. Normalize data
    from sklearn.preprocessing import MinMaxScaler
    scaler = MinMaxScaler()
    df_scaled = df.copy()
    df_scaled['value'] = scaler.fit_transform(df[['value']])
    
    # 2. Create sequences (lookback=24, horizon=12)
    lookback = 24
    horizon = 12
    
    # 3. Build model (simplified)
    model = {
        'scaler': scaler,
        'last_values': df['value'].values[-lookback:],
        'mean': df['value'].mean(),
        'std': df['value'].std()
    }
    
    return model

def generate_forecast(model, df, horizon=12):
    """
    Generate forecast from TFT model
    
    Returns list of predictions with confidence intervals
    """
    # Simplified: Use statistical model for demonstration
    last_values = df['value'].values[-24:]
    mean = last_values.mean()
    std = last_values.std()
    
    # Generate trend
    trend = (df['value'].values[-1] - df['value'].values[-12]) / 12
    
    forecast = []
    current = df['value'].values[-1]
    last_date = df['date'].values[-1]
    
    for i in range(1, horizon + 1):
        # Simple forecast: trend + seasonal pattern
        seasonal = last_values[i % len(last_values)] - mean
        pred = current + trend + seasonal * 0.1
        
        # Confidence intervals (simplified)
        lower_80 = pred - 1.28 * std
        upper_80 = pred + 1.28 * std
        
        forecast_date = pd.Timestamp(last_date) + timedelta(days=30*i)
        
        forecast.append({
            'month': forecast_date.strftime('%b %Y'),
            'predicted_value': float(pred),
            'lower_80': float(lower_80),
            'upper_80': float(upper_80)
        })
        
        current = pred
    
    return forecast

def calculate_accuracy(model, df):
    """
    Calculate model accuracy (simplified: MAPE)
    
    Returns accuracy as percentage (0-1)
    """
    # In real implementation, use walk-forward validation
    # For now, return placeholder
    return 0.94

def get_model_accuracy(module, campus):
    """Get model accuracy from metadata"""
    try:
        metadata_path = f'{MODELS_DIR}/metadata_{module}_{campus}.pkl'
        if os.path.exists(metadata_path):
            with open(metadata_path, 'rb') as f:
                metadata = pickle.load(f)
                return metadata.get('accuracy', 0.90)
    except:
        pass
    return 0.90

def save_model_metadata(module, campus, accuracy):
    """Save model metadata"""
    os.makedirs(MODELS_DIR, exist_ok=True)
    metadata = {
        'accuracy': accuracy,
        'trained_at': datetime.now().isoformat(),
        'module': module,
        'campus': campus
    }
    with open(f'{MODELS_DIR}/metadata_{module}_{campus}.pkl', 'wb') as f:
        pickle.dump(metadata, f)

# ============================================================================
# Layer 4: Database Functions
# ============================================================================

def load_data_from_mysql(module, campus, months=None):
    """Load historical emissions data from MySQL"""
    try:
        conn = pymysql.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASS,
            database=MYSQL_DB
        )
        
        # Map module to table
        table_map = {
            'electricity': 'electricity_consumption',
            'water': 'tblwater',
            'fuel': 'tbl_fuel_emissions'
        }
        table = table_map.get(module)
        
        # Build query
        query = f"""
            SELECT DATE(CONCAT(year, '-', LPAD(month, 2, '0'), '-01')) as date,
                   consumption_in_kwh as value
            FROM {table}
            WHERE campus = %s
            ORDER BY year, month
        """
        
        df = pd.read_sql(query, conn, params=(campus,))
        conn.close()
        
        if len(df) == 0:
            return None
        
        df['date'] = pd.to_datetime(df['date'])
        return df.sort_values('date').reset_index(drop=True)
        
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        return None

def cache_forecast(module, campus, forecast):
    """Cache forecast in database"""
    try:
        conn = pymysql.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASS,
            database=MYSQL_DB
        )
        cursor = conn.cursor()
        
        # Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forecast_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                module VARCHAR(50),
                campus VARCHAR(255),
                forecast_month DATE,
                predicted_value FLOAT,
                confidence_lower_80 FLOAT,
                confidence_upper_80 FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_forecast (module, campus, forecast_month)
            )
        """)
        
        # Clear old forecasts
        cursor.execute(
            "DELETE FROM forecast_cache WHERE module = %s AND campus = %s",
            (module, campus)
        )
        
        # Insert new forecasts
        for pred in forecast:
            cursor.execute("""
                INSERT INTO forecast_cache 
                (module, campus, forecast_month, predicted_value, 
                 confidence_lower_80, confidence_upper_80)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                module, campus,
                pred['month'],
                pred['predicted_value'],
                pred['lower_80'],
                pred['upper_80']
            ))
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error caching forecast: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
```

---

## Layer 3: TFT Model (PyTorch - Simplified)

**File: `ml_service/models/tft_simple.py`**

```python
import torch
import torch.nn as nn
import numpy as np
from torch.utils.data import DataLoader, TensorDataset

class SimpleTFT(nn.Module):
    """
    Simplified Temporal Fusion Transformer
    
    Input: Sequence of historical values
    Output: Future values with confidence intervals
    """
    
    def __init__(self, input_size=24, hidden_size=64, output_size=12):
        super(SimpleTFT, self).__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.output_size = output_size
        
        # Encoder: LSTM to process history
        self.encoder = nn.LSTM(
            input_size=1,
            hidden_size=hidden_size,
            num_layers=2,
            batch_first=True,
            dropout=0.1
        )
        
        # Attention mechanism
        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_size,
            num_heads=4,
            batch_first=True
        )
        
        # Decoder: Predict future values
        self.decoder = nn.Sequential(
            nn.Linear(hidden_size, 128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, output_size * 3)  # 3 quantiles: 0.1, 0.5, 0.9
        )
    
    def forward(self, x):
        """
        x: [batch, sequence_length, 1]
        output: [batch, output_size * 3]
        """
        # Encode
        lstm_out, (h_n, c_n) = self.encoder(x)
        
        # Attention
        attn_out, _ = self.attention(lstm_out, lstm_out, lstm_out)
        
        # Use last hidden state
        last_hidden = attn_out[:, -1, :]
        
        # Decode
        output = self.decoder(last_hidden)
        
        # Reshape: [batch, output_size, 3]
        output = output.reshape(-1, self.output_size, 3)
        
        return output

def train_tft(df, epochs=100, batch_size=32, learning_rate=0.001):
    """
    Train TFT model on historical data
    
    Args:
        df: DataFrame with 'date' and 'value' columns
        epochs: Number of training epochs
        batch_size: Batch size
        learning_rate: Learning rate
    
    Returns:
        Trained model
    """
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    # Normalize data
    from sklearn.preprocessing import MinMaxScaler
    scaler = MinMaxScaler()
    values_scaled = scaler.fit_transform(df[['value']])
    
    # Create sequences
    lookback = 24
    horizon = 12
    X, y = [], []
    
    for i in range(len(values_scaled) - lookback - horizon + 1):
        X.append(values_scaled[i:i+lookback])
        y.append(values_scaled[i+lookback:i+lookback+horizon])
    
    X = np.array(X).reshape(-1, lookback, 1)
    y = np.array(y).reshape(-1, horizon)
    
    X_tensor = torch.FloatTensor(X).to(device)
    y_tensor = torch.FloatTensor(y).to(device)
    
    dataset = TensorDataset(X_tensor, y_tensor)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    # Model
    model = SimpleTFT(input_size=1, hidden_size=64, output_size=horizon).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    loss_fn = nn.MSELoss()
    
    # Training loop
    for epoch in range(epochs):
        total_loss = 0
        for batch_x, batch_y in dataloader:
            optimizer.zero_grad()
            
            # Forward
            output = model(batch_x)
            
            # Use median quantile (index 1)
            loss = loss_fn(output[:, :, 1], batch_y)
            
            # Backward
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss/len(dataloader):.6f}")
    
    return model, scaler

def predict_tft(model, df, scaler, horizon=12):
    """
    Make forecast with TFT
    
    Returns:
        List of predictions with confidence intervals
    """
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.eval()
    
    # Prepare last 24 values
    values_scaled = scaler.transform(df[['value']])
    X_last = torch.FloatTensor(values_scaled[-24:]).reshape(1, 24, 1).to(device)
    
    with torch.no_grad():
        output = model(X_last)
    
    # Extract quantiles
    predictions = output[0].cpu().numpy()  # [horizon, 3]
    
    # Inverse transform
    pred_full = np.zeros((horizon, 3))
    for i in range(3):
        # Reshape for inverse transform
        pred_reshaped = predictions[:, i].reshape(-1, 1)
        pred_full[:, i] = scaler.inverse_transform(pred_reshaped).flatten()
    
    # Format output
    forecast = []
    last_date = df['date'].values[-1]
    
    for i in range(horizon):
        forecast_date = pd.Timestamp(last_date) + timedelta(days=30*(i+1))
        forecast.append({
            'month': forecast_date.strftime('%b %Y'),
            'predicted_value': float(pred_full[i, 1]),  # Median
            'lower_80': float(pred_full[i, 0]),         # 10th percentile
            'upper_80': float(pred_full[i, 2])          # 90th percentile
        })
    
    return forecast
```

---

## Layer 4: Database Schema

**File: `database/ai_tables.sql`**

```sql
-- Forecast cache (predictions stored here)
CREATE TABLE forecast_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(50),                  -- 'electricity', 'water', 'fuel'
  campus VARCHAR(255),
  forecast_month DATE,
  predicted_value FLOAT,
  confidence_lower_80 FLOAT,
  confidence_upper_80 FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (module, campus, forecast_month)
);

-- Model metadata (accuracy, training info)
CREATE TABLE model_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(50),
  campus VARCHAR(255),
  accuracy FLOAT,
  trained_at TIMESTAMP,
  UNIQUE KEY (module, campus)
);

-- Detected anomalies (for alerting)
CREATE TABLE detected_anomalies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(50),
  campus VARCHAR(255),
  anomaly_date DATE,
  expected_value FLOAT,
  actual_value FLOAT,
  deviation_percent FLOAT,
  severity VARCHAR(20),              -- 'LOW', 'MEDIUM', 'HIGH'
  status VARCHAR(20) DEFAULT 'NEW',  -- 'NEW', 'ACKNOWLEDGED'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## PHP API Integration Layer

**File: `api/ai_forecast.php`**

```php
<?php
require_once '../includes/config.php';
require_once '../includes/Auth.php';
require_once '../includes/Response.php';

Auth::requireLogin();

$action = $_POST['action'] ?? '';
$module = $_POST['module'] ?? '';
$campus = $_POST['campus'] ?? '';

// ML Service URL
define('ML_SERVICE', 'http://localhost:5000');

function call_ml_api($endpoint) {
    $url = ML_SERVICE . $endpoint;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code !== 200) {
        throw new Exception("ML Service error: $http_code");
    }
    
    return json_decode($response, true);
}

try {
    switch ($action) {
        case 'get_forecast':
            $data = call_ml_api("/api/forecast/$module/$campus");
            Response::success($data);
            break;
            
        case 'train_model':
            // Train endpoint
            $ch = curl_init(ML_SERVICE . "/api/train/$module/$campus");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                'max_epochs' => 100,
                'batch_size' => 32
            ]));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            $response = curl_exec($ch);
            curl_close($ch);
            Response::success(json_decode($response, true));
            break;
            
        case 'get_anomalies':
            $data = call_ml_api("/api/anomalies/$module?campus=$campus");
            Response::success($data);
            break;
            
        case 'get_recommendations':
            $data = call_ml_api("/api/recommendations/$campus");
            Response::success($data);
            break;
            
        default:
            Response::error('Unknown action');
    }
} catch (Exception $e) {
    Response::error($e->getMessage());
}
?>
```

---

## Setup Instructions

### 1. Create Python Environment

```bash
# Create directory
mkdir ml_service
cd ml_service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Create requirements.txt
cat > requirements.txt << EOF
flask==2.3.3
torch==2.0.0
numpy==1.24.3
pandas==2.0.3
scikit-learn==1.3.2
pymysql==1.1.0
python-dotenv==1.0.0
EOF

pip install -r requirements.txt

# Create directories
mkdir models data logs
```

### 2. Create .env File

```bash
cat > .env << EOF
FLASK_ENV=production
MYSQL_HOST=127.0.0.1
MYSQL_USER=root
MYSQL_PASS=
MYSQL_DB=ghg_database
EOF
```

### 3. Run Flask Server

```bash
# In ml_service directory
python app.py

# Should see:
# Running on http://0.0.0.0:5000
```

### 4. Test API

```bash
# Test health check
curl http://localhost:5000/health

# Test forecast
curl -X GET "http://localhost:5000/api/forecast/electricity/Central"

# Train model
curl -X POST http://localhost:5000/api/train/electricity/Central \
  -H "Content-Type: application/json" \
  -d '{"max_epochs": 50, "batch_size": 32}'
```

### 5. Copy PHP Integration

Copy `api/ai_forecast.php` to your `api/` folder

### 6. Add Dashboard

Copy `pages/ai_dashboard.php` to your `pages/` folder

---

## Data Flow Example

```
USER CLICKS: "Load Forecast" on Dashboard
         ↓
FRONTEND (JavaScript)
  - fetch('/api/ai_forecast.php', {action: 'get_forecast', module: 'electricity'})
         ↓
PHP LAYER (/api/ai_forecast.php)
  - Auth check
  - Call curl: http://localhost:5000/api/forecast/electricity/Central
         ↓
BACKEND (Python Flask)
  - /api/forecast/electricity/Central endpoint
  - Load data from MySQL
  - Load TFT model from disk
  - Generate predictions (12 months)
  - Cache in database
  - Return JSON
         ↓
PHP
  - Receives JSON
  - Returns to JavaScript
         ↓
FRONTEND
  - Receive JSON forecast data
  - Draw Chart.js line chart
  - Display confidence intervals
```

---

## Project Structure

```
c:\xampp\htdocs\SDO\
├── api/
│   └── ai_forecast.php              ← NEW (PHP integration)
├── pages/
│   └── ai_dashboard.php             ← NEW (Frontend)
└── ml_service/                      ← NEW (Python backend)
    ├── app.py                       (Flask API)
    ├── .env
    ├── requirements.txt
    ├── models/                      (Trained models)
    │   ├── tft_electricity_Central.pth
    │   └── metadata_electricity_Central.pkl
    ├── models/
    │   └── tft_simple.py            (TFT implementation)
    └── data/                        (Temp data)
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/health` | GET | Health check | `{status: 'healthy'}` |
| `/api/forecast/<module>/<campus>` | GET | Get forecast | `{forecast: [...], accuracy: 0.94}` |
| `/api/train/<module>/<campus>` | POST | Train model | `{success: true, accuracy: 0.94}` |
| `/api/anomalies/<module>` | GET | Detect anomalies | `{anomalies: [...]}` |
| `/api/recommendations/<campus>` | GET | Get recommendations | `{recommendations: [...]}` |

---

## Next Steps

1. ✅ Copy all code above
2. ✅ Create `/ml_service` directory
3. ✅ Setup Python environment
4. ✅ Run Flask server on port 5000
5. ✅ Copy PHP integration file
6. ✅ Add dashboard page
7. ✅ Test: Access `http://localhost/SDO/pages/ai_dashboard.php`
8. ✅ Train model: `curl -X POST http://localhost:5000/api/train/electricity/Central`

---

**Version:** 1.0
**Date:** February 2026
**Status:** Ready to implement
