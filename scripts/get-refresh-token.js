const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to ensure refresh token is returned
});

console.log('\n1. Authorize this app by visiting this url:\n');
console.log(authUrl);
console.log('\n2. Enter the code from that page below:\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Code: ', async (code) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
        console.error('Error: No code provided. Please paste the code from the browser.');
        rl.close();
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(trimmedCode);
        console.log('\nSuccessfully retrieved tokens!');
        console.log('\nAdd this to your .env.local file:');
        console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);

        if (!tokens.refresh_token) {
            console.log('\nWARNING: No refresh token returned. We added prompt: "consent" to the auth URL, so this should work. If not, revoke access in your Google Account and try again.');
        }
    } catch (error) {
        console.error('\nError retrieving access token:', error.message);
        if (error.response && error.response.data) {
            console.error('Details:', error.response.data);
        }
    }
    rl.close();
});
