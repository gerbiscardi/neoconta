import os
import re
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from prophet import Prophet
import uvicorn

# Carga segura de variables de entorno desde el archivo .env raíz si no están en el proceso
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except Exception as e:
        pass

app = FastAPI(
    title="NeoConta Data Science Service",
    description="Microservicio interno de Inteligencia Artificial y Machine Learning para NeoConta",
    version="1.1.0"
)

# Configuración de CORS restringida exclusivamente al host local de Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

def verify_internal_auth(x_internal_token: Optional[str] = Header(None)):
    """
    Verifica que la solicitud provenga exclusivamente de Next.js mediante token interno.
    Comportamiento Fail-Closed: La ausencia o debilidad del secreto bloquea cualquier operación.
    """
    expected_secret = os.environ.get("DS_INTERNAL_SECRET")
    if not expected_secret or len(expected_secret.strip()) < 32:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error de configuración interna: DS_INTERNAL_SECRET no está configurado o es insuficiente."
        )
    if not x_internal_token or x_internal_token.strip() != expected_secret.strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Se requiere autenticación interna autorizada."
        )
    return True

# --- MODELOS DE DATOS ---

class CashFlowPoint(BaseModel):
    ds: str  # Fecha en formato YYYY-MM-DD
    y: float # Importe / balance neto

class CashFlowRequest(BaseModel):
    history: List[CashFlowPoint]
    periods: int = 2 # Períodos a predecir a futuro
    freq: Optional[str] = None # 'MS' para mensual, 'D' para diario (auto-detectado si no se envía)

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

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "NeoConta Data Science Internal"}

@app.post("/api/predict/cashflow", dependencies=[Depends(verify_internal_auth)])
def predict_cashflow(request: CashFlowRequest):
    """
    Toma el historial financiero y predice el flujo de caja utilizando Facebook Prophet.
    Acceso restringido internamente a Next.js.
    """
    if len(request.history) < 2:
        raise HTTPException(
            status_code=400,
            detail="Se necesitan al menos 2 puntos históricos para entrenar el modelo predictivo."
        )
    if len(request.history) > 120:
        raise HTTPException(
            status_code=400,
            detail="La cantidad de observaciones históricas excede el límite máximo permitido (120 observaciones)."
        )
    if request.periods < 1 or request.periods > 24:
        raise HTTPException(
            status_code=400,
            detail="El horizonte de predicción debe situarse entre 1 y 24 períodos."
        )
    
    try:
        # Convertir datos a DataFrame de Pandas
        data = [{"ds": p.ds, "y": p.y} for p in request.history]
        df = pd.DataFrame(data)
        
        # Convertir columna ds a datetime
        df['ds'] = pd.to_datetime(df['ds'])
        df = df.sort_values('ds').reset_index(drop=True)
        
        # Detección inteligente de frecuencia mensual vs diaria
        is_monthly = False
        if request.freq == 'MS':
            is_monthly = True
        elif request.freq == 'D':
            is_monthly = False
        elif len(df) > 1:
            diff_days = (df['ds'].iloc[1] - df['ds'].iloc[0]).days
            if diff_days >= 25:
                is_monthly = True

        target_freq = 'MS' if is_monthly else 'D'

        # Configuración estadísticamente rigurosa para evitar oscilaciones de Fourier espurias
        # Desactivamos estacionalidades semanal y diaria en datos agregados mensuales
        model = Prophet(
            yearly_seasonality=len(df) >= 24, # Requiere al menos 2 ciclos anuales completos
            weekly_seasonality=False if is_monthly else (len(df) >= 14),
            daily_seasonality=False,
            interval_width=0.80 # Intervalo creíble del 80%
        )
        
        model.fit(df)
        
        # Crear dataframe para el futuro
        future = model.make_future_dataframe(periods=request.periods, freq=target_freq)
        forecast = model.predict(future)
        
        # Formatear la respuesta
        result = []
        for index, row in forecast.iterrows():
            is_forecast = row['ds'] > df['ds'].max()
            
            # Garantizar que los importes de facturación no sean negativos
            yhat = max(0.0, float(row['yhat']))
            yhat_lower = max(0.0, float(row['yhat_lower']))
            yhat_upper = max(0.0, float(row['yhat_upper']))

            result.append({
                "date": row['ds'].strftime('%Y-%m-%d'),
                "yhat": round(yhat, 2),
                "yhat_lower": round(yhat_lower, 2),
                "yhat_upper": round(yhat_upper, 2),
                "is_prediction": is_forecast
            })
            
        return {
            "success": True,
            "forecast": result,
            "metrics": {
                "historical_points": len(df),
                "predicted_periods": request.periods,
                "frequency": target_freq
            }
        }
        
    except Exception as e:
        # Sanitizar error sin exponer datos financieros en respuestas HTTP
        raise HTTPException(status_code=500, detail="Error en el procesamiento del modelo predictivo.")


@app.post("/api/reconcile/match", dependencies=[Depends(verify_internal_auth)])
def reconcile_match(request: ReconciliationRequest):
    """
    Evalúa y puntúa las facturas pendientes para un movimiento bancario dado
    simulando el árbol de decisión de XGBoost basado en múltiples características.
    Acceso restringido internamente a Next.js.
    """
    movement = request.movement
    invoices = request.invoices
    
    if len(invoices) > 200:
        raise HTTPException(
            status_code=400,
            detail="La lista de comprobantes a evaluar excede el límite máximo permitido (200 comprobantes)."
        )
    
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
