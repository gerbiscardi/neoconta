import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { name, email, phone, message } = await request.json();

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
    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "El mensaje es obligatorio." },
        { status: 400 }
      );
    }

    // 2. Prepare contact data
    const contactData = {
      timestamp: new Date().toISOString(),
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "No especificado",
      message: message.trim(),
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
        secure: parseInt(SMTP_PORT, 10) === 465, // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASSWORD,
        },
      });

      // Send email
      await transporter.sendMail({
        from: `"${name}" <${SMTP_USER}>`, // Sender address
        to: CONTACT_EMAIL, // Institutional inbox
        replyTo: email, // Reply-to visitor's email
        subject: `Nuevo mensaje de contacto de ${name} (NeoConta)`,
        text: `Nombre: ${name}\nEmail: ${email}\nCelular: ${phone || "No especificado"}\n\nMensaje:\n${message}`,
        html: `
          <h3>Nuevo mensaje de contacto de NeoConta</h3>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Celular:</strong> ${phone || "No especificado"}</p>
          <br/>
          <p><strong>Mensaje:</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">
            ${message}
          </div>
        `,
      });

      console.log(`[API Contact] Email successfully sent to ${CONTACT_EMAIL}`);
    } else {
      // 4b. Local Fallback (Dev Mode): Log to console and save to local file
      console.log("=========================================");
      console.log("[API Contact] DEV FALLBACK MODE - Contact Submission Received:");
      console.log(JSON.stringify(contactData, null, 2));
      console.log("=========================================");

      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Write to data/contacts.log
      const logFilePath = path.join(dataDir, "contacts.log");
      const logLine = `${JSON.stringify(contactData)}\n`;
      fs.appendFileSync(logFilePath, logLine, "utf8");
    }

    return NextResponse.json(
      { success: true, message: "Mensaje enviado con éxito." },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API Contact] Error processing contact form:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al enviar el mensaje. Intente de nuevo más tarde." },
      { status: 500 }
    );
  }
}
