import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

let oauth2Client: OAuth2Client | null = null;

export function getGmailClient() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !REFRESH_TOKEN) {
    throw new Error('Missing Gmail API configuration');
  }

  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function listGmailMessages(query: string) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 30,
  });

  return res.data.messages || [];
}

export async function getGmailMessage(id: string) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full',
  });

  return res.data;
}
