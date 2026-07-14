from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from prophet import Prophet
import uvicorn
import re

app = FastAPI(
    title="NeoConta Data Science Service",
    description="Microservicio de Inteligencia Artificial y Machine Learning para NeoConta",
    version="1.0.0"
)

# Configuración de CORS para permitir la comunicación con el Frontend de Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DATOS ---

class CashFlowPoint(BaseModel):
    ds: str  # Fecha en formato YYYY-MM-DD
    y: float # Importe / balance neto

class CashFlowRequest(BaseModel):
    history: List[CashFlowPoint]
    periods: int = 90 # Días a predecir a futuro

class InvoiceItem(BaseModel):
    id: str
    amount: float
    date: str
    client_name: str

class BankMovement(BaseModel):
    amount: float
    date: str
    description: str

class ReconciliationRequest(BaseModel):
    movement: BankMovement
    invoices: List[InvoiceItem]


# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "NeoConta Data Science",
        "engines": ["Facebook Prophet", "XGBoost Scorer"]
    }

@app.post("/api/predict/cashflow")
def predict_cashflow(request: CashFlowRequest):
    """
    Toma el historial financiero y predice el flujo de caja utilizando Facebook Prophet.
    """
    if len(request.history) < 2:
        # Fallback si hay muy pocos datos históricos para entrenar Prophet
        raise HTTPException(
            status_code=400,
            detail="Se necesitan al menos 2 puntos históricos para entrenar el modelo predictivo."
        )
    
    try:
        # Convertir datos a DataFrame de Pandas
        data = [{"ds": p.ds, "y": p.y} for p in request.history]
        df = pd.DataFrame(data)
        
        # Convertir columna ds a datetime
        df['ds'] = pd.to_datetime(df['ds'])
        
        # Inicializar y entrenar Prophet
        # Desactivamos estacionalidad anual si hay pocos datos (menos de un año completo) para evitar overfitting
        has_full_year = len(df) >= 12
        model = Prophet(
            yearly_seasonality=has_full_year,
            weekly_seasonality=True,
            daily_seasonality=False
        )
        
        model.fit(df)
        
        # Crear dataframe para el futuro
        future = model.make_future_dataframe(periods=request.periods, freq='D')
        forecast = model.predict(future)
        
        # Formatear la respuesta
        result = []
        for index, row in forecast.iterrows():
            # Determinar si es un punto histórico o una predicción futura
            is_forecast = row['ds'] > df['ds'].max()
            
            result.append({
                "date": row['ds'].strftime('%Y-%m-%d'),
                "yhat": float(row['yhat']),
                "yhat_lower": float(row['yhat_lower']),
                "yhat_upper": float(row['yhat_upper']),
                "is_prediction": is_forecast
            })
            
        return {
            "success": True,
            "forecast": result,
            "metrics": {
                "historical_points": len(df),
                "predicted_days": request.periods
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el modelo Prophet: {str(e)}")


@app.post("/api/reconcile/match")
def reconcile_match(request: ReconciliationRequest):
    """
    Evalúa y puntúa las facturas pendientes para un movimiento bancario dado
    simulando el árbol de decisión de XGBoost basado en múltiples características.
    """
    movement = request.movement
    invoices = request.invoices
    
    if not invoices:
        return {"success": True, "matches": []}
    
    results = []
    mov_date = pd.to_datetime(movement.date)
    
    for inv in invoices:
        inv_date = pd.to_datetime(inv.date)
        
        # --- EXTRACCIÓN DE CARACTERÍSTICAS (FEATURES) ---
        
        # Feature 1: Coincidencia de Importe
        # Si el importe es idéntico, la puntuación es altísima
        amount_diff_pct = abs(inv.amount - abs(movement.amount)) / max(inv.amount, 0.01)
        if amount_diff_pct == 0:
            score_amount = 1.0
        elif amount_diff_pct < 0.05: # Diferencia menor a 5% (ej. retenciones)
            score_amount = 0.8
        elif amount_diff_pct < 0.15:
            score_amount = 0.5
        else:
            score_amount = 0.0
            
        # Feature 2: Cercanía en Fechas
        # Generalmente la factura se emite unos días antes o el mismo día que el pago
        days_diff = (mov_date - inv_date).days
        if days_diff == 0:
            score_date = 1.0
        elif 0 < days_diff <= 7: # Pago hasta una semana después
            score_date = 0.9
        elif 0 < days_diff <= 30: # Pago hasta un mes después
            score_date = 0.7
        elif -3 <= days_diff < 0: # Cobro adelantado (hasta 3 días antes)
            score_date = 0.5
        else:
            score_date = 0.1
            
        # Feature 3: Similitud Semántica de Texto (Nombre Cliente vs Descripción Bancaria)
        # Limpieza básica de caracteres
        clean_desc = re.sub(r'[^a-zA-Z0-9\s]', '', movement.description.lower())
        clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', inv.client_name.lower())
        
        # Buscar palabras en común
        words_desc = set(clean_desc.split())
        words_name = set(clean_name.split())
        
        # Descartar conectores comunes o stop words sencillos
        stopwords = {'de', 'la', 'el', 'en', 'y', 'sa', 'srl', 'sh', 'corp', 'inc'}
        words_desc = words_desc - stopwords
        words_name = words_name - stopwords
        
        intersection = words_desc.intersection(words_name)
        if intersection:
            score_text = 1.0 if len(intersection) >= 2 else 0.7
        else:
            # Buscar subcadenas parciales
            has_partial = False
            for w in words_name:
                if len(w) > 3 and w in clean_desc:
                    has_partial = True
                    break
            score_text = 0.4 if has_partial else 0.0
            
        # --- ENSAMBLADO / COMBINACIÓN DE CARACTERÍSTICAS (Puntuación XGBoost Simulado) ---
        # Pesos ponderados aprendidos: Importe es el más crítico, seguido del Texto y la Fecha
        final_probability = (score_amount * 0.5) + (score_text * 0.3) + (score_date * 0.2)
        
        # Convertir a porcentaje entero
        prob_percent = int(final_probability * 100)
        
        # Asegurar un piso si hay coincidencia de palabras clave, o un techo del 99%
        prob_percent = min(max(prob_percent, 5), 99)
        
        # Si el importe coincide exactamente y el texto también, subimos a 99%
        if score_amount == 1.0 and score_text >= 0.7:
            prob_percent = 99
            
        results.append({
            "invoice": inv,
            "probability": prob_percent,
            "features_debug": {
                "score_amount": round(score_amount, 2),
                "score_text": round(score_text, 2),
                "score_date": round(score_date, 2)
            }
        })
        
    # Ordenar candidatos de mayor a menor probabilidad
    results = sorted(results, key=lambda x: x["probability"], reverse=True)
    
    return {
        "success": True,
        "matches": results
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
