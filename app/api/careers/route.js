import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const name = formData.get("name");
    const email = formData.get("email");
    const role = formData.get("role");
    const cvFile = formData.get("cv");

    // 1. Basic validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 }
      );
    }
    if (!email || !email.trim() || !email.includes("@")) {
      return NextResponse.json(
        { error: "El correo electrónico no es válido." },
        { status: 400 }
      );
    }
    if (!role || !role.trim()) {
      return NextResponse.json(
        { error: "El área de interés es obligatoria." },
        { status: 400 }
      );
    }
    if (!cvFile || typeof cvFile === "string") {
      return NextResponse.json(
        { error: "El archivo del CV es obligatorio." },
        { status: 400 }
      );
    }

    const arrayBuffer = await cvFile.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 2. Prepare candidate data
    const candidateData = {
      timestamp: new Date().toISOString(),
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      filename: cvFile.name,
      sizeBytes: cvFile.size,
    };

    // 3. Check for SMTP environment variables
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASSWORD,
      CONTACT_EMAIL,
    } = process.env;

    const useSMTP = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD && CONTACT_EMAIL;

    if (useSMTP) {
      // 4a. Initialize Nodemailer transport
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: parseInt(SMTP_PORT, 10) === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASSWORD,
        },
      });

      // Send email with attachment
      await transporter.sendMail({
        from: `"${name}" <${SMTP_USER}>`,
        to: CONTACT_EMAIL,
        replyTo: email,
        subject: `Nueva postulación de ${name} (NeoConta - Carreras)`,
        text: `Nombre: ${name}\nEmail: ${email}\nPuesto: ${role}\n\nSe adjunta el CV recibido (${cvFile.name}).`,
        html: `
          <h3>Nueva postulación recibida en NeoConta</h3>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Puesto de Interés:</strong> ${role}</p>
          <p><strong>Archivo CV:</strong> ${cvFile.name} (${(cvFile.size / 1024).toFixed(1)} KB)</p>
          <br/>
          <p>El CV se adjunta a este correo.</p>
        `,
        attachments: [
          {
            filename: cvFile.name,
            content: fileBuffer,
          },
        ],
      });

      console.log(`[API Careers] Application email successfully sent to ${CONTACT_EMAIL}`);
    } else {
      // 4b. Local Fallback (Dev Mode): Log metadata, save file and log to file
      console.log("=========================================");
      console.log("[API Careers] DEV FALLBACK MODE - CV Upload Received:");
      console.log(JSON.stringify(candidateData, null, 2));
      console.log("=========================================");

      // Create data and data/cvs directories if they don't exist
      const dataDir = path.join(process.cwd(), "data");
      const cvsDir = path.join(dataDir, "cvs");
      if (!fs.existsSync(cvsDir)) {
        fs.mkdirSync(cvsDir, { recursive: true });
      }

      // Write CV file to disk
      const timestamp = Date.now();
      const sanitizedFilename = cvFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const savedFileName = `${timestamp}_${sanitizedFilename}`;
      const savedFilePath = path.join(cvsDir, savedFileName);
      fs.writeFileSync(savedFilePath, fileBuffer);

      // Add file path to candidate metadata log
      candidateData.localPath = savedFilePath;

      // Write to data/careers.log
      const logFilePath = path.join(dataDir, "careers.log");
      const logLine = `${JSON.stringify(candidateData)}\n`;
      fs.appendFileSync(logFilePath, logLine, "utf8");
      
      console.log(`[API Careers] Saved CV locally to ${savedFilePath}`);
    }

    return NextResponse.json(
      { success: true, message: "Postulación enviada con éxito." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API Careers] Error processing CV upload:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar tu postulación. Intenta de nuevo más tarde." },
      { status: 500 }
    );
  }
}
