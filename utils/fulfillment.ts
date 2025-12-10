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
        // Use ZeptoMail SMTP settings
        const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.zeptomail.com';
        const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '587');
        const smtpUser = process.env.EMAIL_SMTP_USER || process.env.EMAIL_SERVER_USER || 'emailapikey';
        const smtpPass = process.env.EMAIL_SMTP_PASSWORD || process.env.EMAIL_SERVER_PASSWORD;

        console.log('Email Configuration for sendOrderEmail:');
        console.log('  Host:', smtpHost);
        console.log('  Port:', smtpPort);
        console.log('  User:', smtpUser);
        console.log('  Password:', smtpPass ? `${smtpPass.substring(0, 4)}...${smtpPass.substring(smtpPass.length - 4)}` : 'MISSING');

        if (!smtpPass) {
            throw new Error('Email password not configured');
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: process.env.EMAIL_SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'noreply@nicknamespace.com',
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

        // Send to both admin emails
        const emailPromises = [
            transporter.sendMail({
                ...mailOptions,
                to: 'info@nicknamespace.com'
            }),
            transporter.sendMail({
                ...mailOptions,
                to: 'cityzenill@gmail.com'
            })
        ];
        
        // Also send to the original 'to' address if provided and different
        if (to && to !== 'info@nicknamespace.com' && to !== 'cityzenill@gmail.com') {
            emailPromises.push(transporter.sendMail({
                ...mailOptions,
                to: to
            }));
        }

        const results = await Promise.allSettled(emailPromises);
        
        // Log results
        if (results[0].status === 'fulfilled') {
            console.log('Email sent to info@nicknamespace.com:', results[0].value.response);
        } else {
            console.error('Failed to send to info@nicknamespace.com:', results[0].reason);
        }
        
        if (results[1].status === 'fulfilled') {
            console.log('Email sent to cityzenill@gmail.com:', results[1].value.response);
        } else {
            console.error('Failed to send to cityzenill@gmail.com:', results[1].reason);
        }
        
        if (results[2]) {
            if (results[2].status === 'fulfilled') {
                console.log(`Email sent to ${to}:`, results[2].value.response);
            } else {
                console.error(`Failed to send to ${to}:`, results[2].reason);
            }
        }

        // Return true if at least one email was sent successfully
        return results.some(result => result.status === '
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

/**
 * Sends order completion emails to both info@nicknamespace.com and the customer
 * @param {Object} orderData - The order data with delivery/pickup details
 * @returns {Promise<boolean>} Success status
 */
export async function sendOrderCompletionEmails(orderData: any) {
    try {
        // Use ZeptoMail SMTP settings
        // ZeptoMail uses smtp.zeptomail.com
        const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.zeptomail.com';
        const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '587');
        const smtpUser = process.env.EMAIL_SMTP_USER || process.env.EMAIL_SERVER_USER || 'emailapikey';
        const smtpPass = process.env.EMAIL_SMTP_PASSWORD || process.env.EMAIL_SERVER_PASSWORD;

        // Debug logging (don't log full password, just first/last chars)
        console.log('Email Configuration:');
        console.log('  Host:', smtpHost);
        console.log('  Port:', smtpPort);
        console.log('  User:', smtpUser);
        console.log('  Password:', smtpPass ? `${smtpPass.substring(0, 4)}...${smtpPass.substring(smtpPass.length - 4)}` : 'MISSING');

        if (!smtpPass) {
            console.error('❌ EMAIL_SMTP_PASSWORD or EMAIL_SERVER_PASSWORD is not set!');
            console.error('Please check your .env.local file');
            throw new Error('Email password not configured');
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: process.env.EMAIL_SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        const orderId = orderData.orderId || orderData.id || 'Unknown';
        const customerName = orderData.customerName || 'Customer';
        const customerEmail = orderData.customerEmail;
        const orderType = orderData.deliveryInfo ? 'Delivery' : orderData.pickupInfo ? 'Pickup' : 'Order';
        
        // Format order details
        const itemsList = orderData.items?.map((item: any) => 
            `${item.quantity} x ${item.name} ($${item.price} each)`
        ).join('\n') || 'No items';
        
        const address = orderData.deliveryInfo 
            ? `${orderData.deliveryInfo.address?.street || ''}, ${orderData.deliveryInfo.address?.city || ''}, ${orderData.deliveryInfo.address?.state || ''} ${orderData.deliveryInfo.address?.zipCode || ''}`
            : orderData.pickupInfo?.address || 'N/A';
        
        const deliveryDate = orderData.deliveryInfo?.date || orderData.pickupInfo?.date || 'N/A';
        const deliveryTime = orderData.deliveryInfo?.time || orderData.pickupInfo?.time || 'N/A';
        
        // Email to info@nicknamespace.com (admin notification)
        const adminEmailHtml = `
            <h2>New Order Completed - ${orderType}</h2>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Customer Email:</strong> ${customerEmail || 'N/A'}</p>
            <p><strong>Customer Phone:</strong> ${orderData.customerPhone || orderData.deliveryInfo?.phone || orderData.pickupInfo?.phone || 'N/A'}</p>
            <hr>
            <h3>Order Details</h3>
            <p><strong>Type:</strong> ${orderType}</p>
            <p><strong>Date:</strong> ${deliveryDate}</p>
            <p><strong>Time:</strong> ${deliveryTime}</p>
            <p><strong>Address:</strong> ${address}</p>
            <h4>Items:</h4>
            <pre>${itemsList}</pre>
            <p><strong>Subtotal:</strong> $${orderData.subtotal || '0.00'}</p>
            <p><strong>Delivery Fee:</strong> $${orderData.deliveryFee || '0.00'}</p>
            <p><strong>Tax:</strong> $${orderData.tax || '0.00'}</p>
            <p><strong>Total:</strong> $${orderData.total || '0.00'}</p>
            ${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions ? `<p><strong>Special Instructions:</strong> ${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions}</p>` : ''}
        `;

        const adminEmailText = `
New Order Completed - ${orderType}

Order ID: ${orderId}
Customer: ${customerName}
Customer Email: ${customerEmail || 'N/A'}
Customer Phone: ${orderData.customerPhone || orderData.deliveryInfo?.phone || orderData.pickupInfo?.phone || 'N/A'}

Order Details:
Type: ${orderType}
Date: ${deliveryDate}
Time: ${deliveryTime}
Address: ${address}

Items:
${itemsList}

Subtotal: $${orderData.subtotal || '0.00'}
Delivery Fee: $${orderData.deliveryFee || '0.00'}
Tax: $${orderData.tax || '0.00'}
Total: $${orderData.total || '0.00'}
${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions ? `Special Instructions: ${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions}` : ''}
        `;

        // Email to customer (confirmation)
        const customerEmailHtml = `
            <h2>Order Confirmation - ${orderType}</h2>
            <p>Thank you for your order, ${customerName}!</p>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <hr>
            <h3>Order Details</h3>
            <p><strong>Type:</strong> ${orderType}</p>
            <p><strong>Date:</strong> ${deliveryDate}</p>
            <p><strong>Time:</strong> ${deliveryTime}</p>
            ${orderType === 'Delivery' ? `<p><strong>Delivery Address:</strong> ${address}</p>` : ''}
            ${orderType === 'Pickup' ? `<p><strong>Pickup Location:</strong> ${address}</p>` : ''}
            <h4>Items:</h4>
            <pre>${itemsList}</pre>
            <p><strong>Subtotal:</strong> $${orderData.subtotal || '0.00'}</p>
            <p><strong>Delivery Fee:</strong> $${orderData.deliveryFee || '0.00'}</p>
            <p><strong>Tax:</strong> $${orderData.tax || '0.00'}</p>
            <p><strong>Total:</strong> $${orderData.total || '0.00'}</p>
            ${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions ? `<p><strong>Special Instructions:</strong> ${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions}</p>` : ''}
            <hr>
            <p>We'll see you soon!</p>
            <p>If you have any questions, please contact us at info@nicknamespace.com</p>
        `;

        const customerEmailText = `
Order Confirmation - ${orderType}

Thank you for your order, ${customerName}!

Order ID: ${orderId}

Order Details:
Type: ${orderType}
Date: ${deliveryDate}
Time: ${deliveryTime}
${orderType === 'Delivery' ? `Delivery Address: ${address}` : ''}
${orderType === 'Pickup' ? `Pickup Location: ${address}` : ''}

Items:
${itemsList}

Subtotal: $${orderData.subtotal || '0.00'}
Delivery Fee: $${orderData.deliveryFee || '0.00'}
Tax: $${orderData.tax || '0.00'}
Total: $${orderData.total || '0.00'}
${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions ? `Special Instructions: ${orderData.deliveryInfo?.instructions || orderData.pickupInfo?.instructions}` : ''}

We'll see you soon!

If you have any questions, please contact us at info@nicknamespace.com
        `;

        // Send email to both admin addresses
        const adminMailOptions = {
            from: process.env.EMAIL_FROM || 'no-reply@nicknamespace.com',
            to: 'info@nicknamespace.com, cityzenill@gmail.com',
            subject: `New ${orderType} Order: ${orderId}`,
            text: adminEmailText,
            html: adminEmailHtml,
        };

        // Send email to customer
        const customerMailOptions = {
            from: process.env.EMAIL_FROM || 'no-reply@nicknamespace.com',
            to: customerEmail,
            subject: `Order Confirmation - ${orderId}`,
            text: customerEmailText,
            html: customerEmailHtml,
        };

        // Send all emails
        const [adminResult, customerResult] = await Promise.allSettled([
            transporter.sendMail(adminMailOptions),
            customerEmail ? transporter.sendMail(customerMailOptions) : Promise.resolve(null)
        ]);

        if (adminResult.status === 'fulfilled') {
            console.log('Admin email sent to info@nicknamespace.com and cityzenill@gmail.com:', adminResult.value.response);
        } else {
            console.error('Failed to send admin email:', adminResult.reason);
        }

        if (customerResult.status === 'fulfilled' && customerResult.value) {
            console.log('Customer email sent:', customerResult.value.response);
        } else if (customerResult.status === 'rejected') {
            console.error('Failed to send customer email:', customerResult.reason);
        } else if (!customerEmail) {
            console.warn('No customer email provided, skipping customer notification');
        }

        // Return true if admin email was sent successfully
        return adminResult.status === 'fulfilled';
    } catch (error: any) {
        console.error('Error sending order completion emails:', error);
        try {
            fs.appendFileSync('fulfillment-errors.log', `[${new Date().toISOString()}] Order Completion Email Error: ${error.message}\n${JSON.stringify(error, null, 2)}\n`);
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
