import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const CONFIG_PATH = join(process.cwd(), 'data', 'platform_config.json');

async function getPlatformConfig() {
    try {
        const data = await readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        // Return default values if config file doesn't exist
        return {
            baseSubscription: 4500000,
            costPerClient: 125000
        };
    }
}

// GET: Retrieve platform config
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const callerRole = searchParams.get('callerRole');

        if (callerRole !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const config = await getPlatformConfig();
        return NextResponse.json({ success: true, config });
    } catch (error) {
        console.error("Error in GET platform config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Save platform config
export async function POST(request) {
    try {
        const { baseSubscription, costPerClient, callerRole } = await request.json();

        if (callerRole !== 'owner') {
            return NextResponse.json({ error: "No autorizado. Solo el dueño de NeoConta puede realizar esta acción." }, { status: 403 });
        }

        const config = {
            baseSubscription: Number(baseSubscription) || 4500000,
            costPerClient: Number(costPerClient) || 125000
        };

        await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        return NextResponse.json({ success: true, config });
    } catch (error) {
        console.error("Error in POST platform config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
