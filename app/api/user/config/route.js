import { NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const userDir = join(process.cwd(), 'data', 'users', userId);
        const configPath = join(userDir, 'config.json');
        const certPath = join(userDir, 'cert.crt');

        let config = { razonSocial: "", cuit: "", production: false };
        if (existsSync(configPath)) {
            const fileData = await readFile(configPath, 'utf8');
            config = JSON.parse(fileData);
        }

        return NextResponse.json({
            success: true,
            razonSocial: config.razonSocial || "",
            cuit: config.cuit || "",
            production: config.production === true,
            logo: config.logo || "",
            hasCert: existsSync(certPath)
        });

    } catch (error) {
        console.error("Error loading user config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.formData();
        const userId = data.get('userId');
        const razonSocial = data.get('razonSocial');
        const cuit = data.get('cuit');
        const production = data.get('production') === 'true';
        const logo = data.get('logo') || '';
        const certFile = data.get('cert'); // File object
        const keyFile = data.get('key');   // File object

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Directory: data/users/{userId}
        const userDir = join(process.cwd(), 'data', 'users', userId);

        // Ensure directory exists
        await mkdir(userDir, { recursive: true });

        // Save JSON Config
        const configPath = join(userDir, 'config.json');
        let config = { razonSocial, cuit, production, logo };

        // Save files if provided
        if (certFile instanceof Blob) {
            const buffer = Buffer.from(await certFile.arrayBuffer());
            await writeFile(join(userDir, 'cert.crt'), buffer);
        }

        if (keyFile instanceof Blob && keyFile.size > 0) {
            const buffer = Buffer.from(await keyFile.arrayBuffer());
            await writeFile(join(userDir, 'private.key'), buffer);
        }

        // Update config file
        await writeFile(configPath, JSON.stringify(config, null, 2));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error saving user config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
