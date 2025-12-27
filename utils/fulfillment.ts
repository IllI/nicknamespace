import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Explicitly load .env.local manually to ensure it works
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    console.log('Attempting to load .env.local from:', envPath);
    if (fs.existsSync(envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        let loadedCount = 0;
        for (const k in envConfig) {
            if (!process.env[k]) {
                process.env[k] = envConfig[k];
                loadedCount++;
            }
        }
        console.log(`Manually loaded ${loadedCount} new variables from .env.local`);
    } else {
        console.log('.env.local file not found at:', envPath);
    }
} catch (error) {
    console.error('Error manually loading .env.local:', error);
}

console.log('Fulfillment Env Check:');
console.log('EMAIL_SERVER_USER:', process.env.EMAIL_SERVER_USER ? 'Set' : 'Missing');
console.log('EMAIL_SERVER_PASSWORD:', process.env.EMAIL_SERVER_PASSWORD ? 'Set' : 'Missing');
console.log('GOOGLE_OAUTH_CLIENT_ID:', process.env.GOOGLE_OAUTH_CLIENT_ID ? 'Set' : 'Missing');
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set' : 'Missing');

export async function sendOrderEmail(to: string, orderDetails: any) {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'noreply@innovative-products.com',
            to: to,
            subject: `New Order Received: ${orderDetails.productName}`,
            text: `
        New Order Received!
        
        Product: ${orderDetails.productName}
        Price: $${orderDetails.amount / 100}
        Customer Email: ${orderDetails.customerEmail}
        Order ID: ${orderDetails.orderId}
        
        Please process this order immediately.
      `,
            html: `
        <h1>New Order Received!</h1>
        <p><strong>Product:</strong> ${orderDetails.productName}</p>
        <p><strong>Price:</strong> $${orderDetails.amount / 100}</p>
        <p><strong>Customer Email:</strong> ${orderDetails.customerEmail}</p>
        <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
        <p>Please process this order immediately.</p>
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return true;
    } catch (error: any) {
        console.error('Error sending email:', error);
        try {
            fs.appendFileSync('fulfillment-errors.log', `[${new Date().toISOString()}] Email Error: ${error.message}\n${JSON.stringify(error, null, 2)}\n`);
        } catch (e) {
            console.error('Error writing to log file:', e);
        }
        return false;
    }
}

export async function createCalendarEvent(orderDetails: any) {
    try {
        const calendarId = '024e4ee88cb4b80278e331ea4030f0d2e39b1485558a5af730efe1398b48a9c7@group.calendar.google.com';
        let authClient: any;

        // Prioritize Service Account
        if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
            console.log('Using Service Account for Calendar Auth');
            const SCOPES = ['https://www.googleapis.com/auth/calendar'];

            let privateKey = process.env.GOOGLE_PRIVATE_KEY;
            // Handle escaped newlines if present
            if (privateKey.includes('\\n')) {
                privateKey = privateKey.replace(/\\n/g, '\n');
            }

            try {
                const googleAuth = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                        private_key: privateKey,
                    },
                    scopes: SCOPES,
                });
                authClient = await googleAuth.getClient();
                console.log('Service Account client created successfully');
            } catch (authError: any) {
                console.error('Service Account creation failed:', authError);
                fs.appendFileSync('fulfillment-errors.log', `[${new Date().toISOString()}] Auth Error: ${authError.message}\n`);
                throw authError;
            }
        }
        // Fallback to OAuth credentials
        else if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
            console.log('Using OAuth for Calendar Auth');
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_OAUTH_CLIENT_ID,
                process.env.GOOGLE_OAUTH_CLIENT_SECRET
            );
            oauth2Client.setCredentials({
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN
            });
            authClient = oauth2Client;
        } else {
            const msg = 'Missing Google Calendar credentials (either OAuth or Service Account)';
            console.error(msg);
            try {
                fs.appendFileSync('fulfillment-errors.log', `[${new Date().toISOString()}] Calendar Auth Error: ${msg}\n`);
            } catch (e) { }
            return false;
        }

        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const event = {
            summary: `Order: ${orderDetails.productName}`,
            description: `Customer: ${orderDetails.customerEmail}\nOrder ID: ${orderDetails.orderId}`,
            start: {
                dateTime: new Date().toISOString(),
            },
            end: {
                dateTime: new Date(new Date().getTime() + 30 * 60000).toISOString(), // 30 mins later
            },
        };

        await calendar.events.insert({
            calendarId: calendarId,
            requestBody: event,
        });

        console.log('Calendar event created');
        return true;
    } catch (error: any) {
        console.error('Error creating calendar event:', error);
        try {
            fs.appendFileSync('fulfillment-errors.log', `[${new Date().toISOString()}] Calendar Error: ${error.message}\n${JSON.stringify(error, null, 2)}\n`);
        } catch (e) {
            console.error('Error writing to log file:', e);
        }
        return false;
    }
}
