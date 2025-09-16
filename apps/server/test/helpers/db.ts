import { Client } from "pg";

export async function isDbAvailable(dbUrl: string): Promise<boolean> {
	try {
		const client = new Client({ connectionString: dbUrl });
		await client.connect();
		await client.query("SELECT 1");
		await client.end();
		return true;
	} catch {
		return false;
	}
}

