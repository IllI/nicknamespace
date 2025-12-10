# How to Set Up Google Calendar Access

You have two options. **Option 2 (Service Account)** is generally recommended for server-side applications like this store because it doesn't require running a script to generate tokens.

## Option 1: OAuth (Act as Yourself)
*Good if you want the events to look like YOU created them.*
1.  Follow the steps above to create an **OAuth Client ID**.
2.  Run the `node scripts/get-refresh-token.js` script.
3.  Requires `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`.

## Option 2: Service Account (Easier for Servers)
*Good for "bots" or automated systems. The event will show as created by the "Service Account".*

1.  **Go to Google Cloud Console**: [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2.  **Create Service Account**:
    *   Click **+ CREATE SERVICE ACCOUNT**.
    *   Name it "Store Bot".
    *   Click **Create and Continue**.
    *   (Optional) Role: "Editor" (or leave blank for just Calendar access).
    *   Click **Done**.
3.  **Create Keys**:
    *   Click on the newly created service account email (e.g., `store-bot@project-id.iam.gserviceaccount.com`).
    *   Go to the **KEYS** tab.
    *   Click **ADD KEY** > **Create new key**.
    *   Select **JSON** and click **Create**.
    *   A file will download. **Keep this safe!**
4.  **Update `.env.local`**:
    *   Open the downloaded JSON file.
    *   Copy the `client_email` value to `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
    *   Copy the `private_key` value to `GOOGLE_PRIVATE_KEY` (copy the whole string including `-----BEGIN PRIVATE KEY...`).
    *   **Remove** the OAuth variables (`GOOGLE_OAUTH_...`) if you have them, to avoid confusion.
5.  **Share the Calendar (CRITICAL STEP)**:
    *   Go to your [Google Calendar](https://calendar.google.com/).
    *   Find the calendar you want to use (the one matching the ID in your code).
    *   Click the three dots > **Settings and sharing**.
    *   Scroll to **Share with specific people**.
    *   Click **Add people**.
    *   Paste the **Service Account Email** (from step 3).
    *   Permission: Select **Make changes to events**.
    *   Click **Send**.

**That's it!** No scripts to run. The app will now use these credentials to write to the calendar.
