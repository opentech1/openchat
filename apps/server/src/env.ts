import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(moduleDir, "..");
const workspaceRoot = resolve(appRoot, "..", "..");

const shouldSkipWorkspaceEnv = (() => {
	const explicitSkip = process.env.SERVER_SKIP_WORKSPACE_ENV;
	if (explicitSkip) {
		return explicitSkip === "1" || explicitSkip.toLowerCase() === "true";
	}
	return process.env.NODE_ENV === "production";
})();

const envFiles = [
	resolve(appRoot, ".env.local"),
	resolve(appRoot, ".env"),
];

if (!shouldSkipWorkspaceEnv) {
	envFiles.push(resolve(workspaceRoot, ".env.local"));
	envFiles.push(resolve(workspaceRoot, ".env"));
}

const loaded = new Set<string>();

for (const file of envFiles) {
	if (loaded.has(file) || !existsSync(file)) continue;
	loaded.add(file);
	loadEnv({ path: file, override: false });
}
