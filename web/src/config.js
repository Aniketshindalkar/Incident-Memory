// Connection settings. None of these are secret: they ship in any frontend.
import { Client, TablesDB, Account } from "appwrite";

export const DATABASE_ID = "6ade33f7000ec6db9ff7";
export const TABLES = {
  incidents: "6ade380800137d4f4ebb",
  services: "6ade36900018f8dd1521",
  symptoms: "6ade3980000169b7f8ad",
  fixes: "6ade3a4a00246b45c776",
  timeline_events: "6ade3ac500251875dd2d",
};

export const client = new Client()
  .setEndpoint("https://sgp.cloud.appwrite.io/v1")
  .setProject("6ade3375000416560f14");

export const tablesDB = new TablesDB(client);
const account = new Account(client);

// Visitors get a silent anonymous session, so they can add data without signing up.
export async function ensureSession() {
  try {
    await account.get();
  } catch {
    await account.createAnonymousSession();
  }
}
