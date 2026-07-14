import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// GET: Get all connected accounts for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Falta el ID del usuario (userId)" }, { status: 400 });
        }

        const userDir = join(process.cwd(), 'data', 'users', userId);
        const connFilePath = join(userDir, 'connections.json');

        let connections = {
            google: { connected: false },
            meta: { connected: false }
        };

        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch (e) {
            // File does not exist, return default empty connections
        }

        // Sanitize connections to hide secret tokens from the frontend
        const sanitized = {};
        for (const [provider, details] of Object.entries(connections)) {
            if (details && details.connected) {
                const { accessToken, refreshToken, ...rest } = details;
                sanitized[provider] = {
                    ...rest,
                    connected: true
                };
            } else {
                sanitized[provider] = { connected: false };
            }
        }

        return NextResponse.json({ success: true, connections: sanitized });

    } catch (error) {
        console.error("Error in GET connections:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Disconnect an account
export async function POST(request) {
    try {
        const { userId, provider, action } = await request.json();

        if (!userId || !provider || action !== 'disconnect') {
            return NextResponse.json({ error: "Faltan datos requeridos (userId, provider, action='disconnect')" }, { status: 400 });
        }

        if (provider !== 'google' && provider !== 'meta') {
            return NextResponse.json({ error: "Proveedor no válido" }, { status: 400 });
        }

        const userDir = join(process.cwd(), 'data', 'users', userId);
        const connFilePath = join(userDir, 'connections.json');

        let connections = {};
        try {
            const data = await readFile(connFilePath, 'utf-8');
            connections = JSON.parse(data);
        } catch (e) {
            return NextResponse.json({ success: true, message: "No había conexiones configuradas." });
        }

        if (connections[provider]) {
            connections[provider] = { connected: false };
            await writeFile(connFilePath, JSON.stringify(connections, null, 2), 'utf-8');
        }

        return NextResponse.json({ success: true, message: `Cuenta de ${provider === 'google' ? 'Google' : 'Meta'} desconectada con éxito.` });

    } catch (error) {
        console.error("Error in POST connections disconnect:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
