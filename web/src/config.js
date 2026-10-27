// Connection settings. None of these are secret: they ship in any frontend.
import { Client, TablesDB } from "appwrite";

export const DATABASE_ID = "6ade33f7000ec6db9ff7";
export const INCIDENTS_TABLE_ID = "6ade380800137d4f4ebb";

const client = new Client()
  .setEndpoint("https://sgp.cloud.appwrite.io/v1")
  .setProject("6ade3375000416560f14");

export const tablesDB = new TablesDB(client);
