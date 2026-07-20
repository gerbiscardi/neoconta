import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === '') {
            return NextResponse.json({
                error: 'La API Key de Gemini (GEMINI_API_KEY) no está configurada en el servidor.'
            }, { status: 500 });
        }

        const body = await request.json();
        const { action, patient, draftText, reason, prescription, observations } = body;

        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        if (action === 'summary') {
            if (!patient || !Array.isArray(patient.consultations)) {
                return NextResponse.json({ error: 'Se requiere información del paciente e historial clínico.' }, { status: 400 });
            }

            // Anonymize/extract clinical consultations
            const clinicalRecords = patient.consultations
                .filter(c => !c.isError)
                .map(c => ({
                    date: c.date,
                    reason: c.reason,
                    observations: c.observations,
                    prescription: c.prescription,
                    professionalSpecialty: c.professionalSpecialty
                }));

            const prompt = `
                Actúa como un médico consultor clínico de alto nivel.
                Analiza el historial clínico del paciente (edad: ${patient.birthDate ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 'No especificada'} años, alertas/alergias registradas: "${patient.importantDetails || 'Sin alertas'}").
                
                Historial de evoluciones:
                ${JSON.stringify(clinicalRecords, null, 2)}

                Genera una síntesis clínica ejecutiva en español técnico pero claro.
                RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO SIGUIENDO ESTE ESQUEMA ESTRICTO:
                {
                    "summary": "Síntesis clínica ejecutiva de 3 a 4 oraciones sobre el estado de salud, evolución reciente y motivo general de atención del paciente.",
                    "activeConditions": ["Lista de diagnósticos crónicos o activos identificados"],
                    "currentTreatments": ["Lista de tratamientos o medicamentos prescritos en el historial"],
                    "keyAlerts": ["Alertas médicas, alergias relevantes o recomendaciones de seguimiento cercano"]
                }
                No incluyas formato markdown ni texto adicional fuera del JSON.
            `;

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            });

            const responseText = result.response.text().trim();
            const data = JSON.parse(responseText);
            return NextResponse.json({ success: true, data });
        }

        if (action === 'soep') {
            if (!draftText || !draftText.trim()) {
                return NextResponse.json({ error: 'El borrador de observaciones es requerido.' }, { status: 400 });
            }

            const prompt = `
                Actúa como un médico profesional especializado en auditoría y redacción de Historias Clínicas Electrónicas.
                Toma las siguientes notas o borrador informal escrito por el médico sobre la consulta (Motivo: "${reason || 'Consulta Médica'}"):
                "${draftText}"

                Transforma y enriquece este borrador organizándolo en el estándar clínico SOEP (Subjetivo, Objetivo, Evaluación, Plan).
                Mantén la veracidad de lo anotado por el profesional sin inventar datos clínicos no sugeridos, pero utiliza una redacción técnica, profesional y prolija.

                RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO SIGUIENDO ESTE ESQUEMA ESTRICTO:
                {
                    "formattedSOEP": "Texto completo formateado en formato SOEP con encabezados claros:\\n\\n[SUBJETIVO]\\n...\\n\\n[OBJETIVO]\\n...\\n\\n[EVALUACIÓN]\\n...\\n\\n[PLAN]\\n..."
                }
                No incluyas formato markdown fuera del JSON.
            `;

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            });

            const responseText = result.response.text().trim();
            const data = JSON.parse(responseText);
            return NextResponse.json({ success: true, data });
        }

        if (action === 'patient_instructions') {
            const userPrescription = prescription || '';
            const userObs = observations || '';
            const allergies = patient?.importantDetails || '';

            const prompt = `
                Actúa como un profesional de la salud empático y claro, enfocado en la seguridad y comunicación con el paciente.
                Analiza las indicaciones prescritas por el médico:
                - Receta / Prescripción: "${userPrescription}"
                - Observaciones Clínicas: "${userObs}"
                - Alergias / Antecedentes conocidos del paciente: "${allergies}"

                Realiza dos tareas:
                1. Chequeo de Seguridad: Evalúa si existe alguna contradicción directa o alergia evidente entre las indicación prescrita y las alergias del paciente.
                2. Guía para el Paciente: Traduce la prescripción técnica a una guía práctica, amigable y muy clara para el paciente (explicando horarios sugeridos, si tomar con alimentos, cuidados generales y pautas de alarma).

                RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO SIGUIENDO ESTE ESQUEMA ESTRICTO:
                {
                    "hasSafetyWarning": boolean,
                    "safetyWarning": "Texto de advertencia breve si hay posible conflicto entre receta y alergia (o vacio '' si es seguro)",
                    "patientGuide": "Texto completo y empático dirigido al paciente listo para copiar o enviar por WhatsApp."
                }
                No incluyas markdown fuera del JSON.
            `;

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            });

            const responseText = result.response.text().trim();
            const data = JSON.parse(responseText);
            return NextResponse.json({ success: true, data });
        }

        return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });

    } catch (error) {
        console.error('Error in /api/vitacore/ai:', error);
        return NextResponse.json({ error: error.message || 'Error en el servicio de IA.' }, { status: 500 });
    }
}
