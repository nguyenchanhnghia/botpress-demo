import "server-only";
import { Client } from "@botpress/client";

let cachedClient: Client | null = null;

function getEnv() {
  const token = process.env.BOTPRESS_TOKEN;
  const botId = process.env.BOT_ID;
  const apiUrl = process.env.BOT_PRESS_CLOUD_API_URL;

  if (!token || !botId) {
    throw new Error(
      "Missing BOTPRESS env: set BOTPRESS_TOKEN (or BOTPRESS_API_USER_KEY) and BOT_ID"
    );
  }

  return { token, botId, apiUrl };
}

export function getBotpressClient(): Client {
  if (cachedClient) return cachedClient;

  const { token, botId, apiUrl } = getEnv();
  cachedClient = new Client({
    token,
    botId,
    ...(apiUrl ? { apiUrl } : {}),
  });

  return cachedClient;
}

