import fs from 'fs/promises';
import path from 'path';

const getWidgetsFilePath = (userId) => {
    return path.join(process.cwd(), 'data', 'users', userId, 'widgets.json');
};

const defaultWidgets = [
    {
        id: "kpi_facturacion",
        title: "Facturación Neta Total",
        type: "kpi",
        dataSource: "invoices",
        yAxisMeasure: "amount",
        aggregation: "sum",
        width: "half"
    },
    {
        id: "kpi_depositos",
        title: "Total de Depósitos Bancarios",
        type: "kpi",
        dataSource: "transactions",
        yAxisMeasure: "amount",
        aggregation: "sum",
        width: "half"
    },
    {
        id: "chart_facturacion_mensual",
        title: "Facturación Mensual Neta",
        type: "chart",
        chartType: "bar",
        dataSource: "invoices",
        xAxisDimension: "month",
        yAxisMeasure: "amount",
        aggregation: "sum",
        width: "half"
    },
    {
        id: "chart_depositos_mensual",
        title: "Depósitos Mensuales",
        type: "chart",
        chartType: "line",
        dataSource: "transactions",
        xAxisDimension: "month",
        yAxisMeasure: "amount",
        aggregation: "sum",
        width: "half"
    },
    {
        id: "chart_vouchers",
        title: "Distribución por Tipo de Comprobante",
        type: "chart",
        chartType: "pie",
        dataSource: "invoices",
        xAxisDimension: "voucherType",
        yAxisMeasure: "amount",
        aggregation: "sum",
        width: "half"
    },
    {
        id: "chart_bancos",
        title: "Participación por Cuenta Bancaria",
        type: "chart",
        chartType: "pie",
        dataSource: "transactions",
        xAxisDimension: "bank",
        yAxisMeasure: "amount",
        aggregation: "sum",
        width: "half"
    }
];

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400 });
        }

        const widgetsFilePath = getWidgetsFilePath(userId);
        let widgets = [];

        try {
            const data = await fs.readFile(widgetsFilePath, 'utf-8');
            widgets = JSON.parse(data);
        } catch (err) {
            // File does not exist, return defaults and optionally create file
            widgets = defaultWidgets;
            await fs.mkdir(path.dirname(widgetsFilePath), { recursive: true });
            await fs.writeFile(widgetsFilePath, JSON.stringify(defaultWidgets, null, 2));
        }

        return new Response(JSON.stringify({ success: true, widgets }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/widgets GET:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, widgets } = body;

        if (!userId || !widgets || !Array.isArray(widgets)) {
            return new Response(JSON.stringify({ error: 'userId and widgets array are required' }), { status: 400 });
        }

        const widgetsFilePath = getWidgetsFilePath(userId);
        await fs.mkdir(path.dirname(widgetsFilePath), { recursive: true });
        await fs.writeFile(widgetsFilePath, JSON.stringify(widgets, null, 2));

        return new Response(JSON.stringify({ success: true, message: 'Configuración de widgets guardada correctamente.', widgets }), { status: 200 });
    } catch (error) {
        console.error('Error in /api/commander/widgets POST:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
}
