import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(moduleDir, "..");
const workspaceRoot = resolve(appRoot, "..", "..");

function parseBoolean(value: string | undefined) {
	if (!value) return undefined;
	const normalized = value.trim().toLowerCase();
	if (normalized === "") return undefined;
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return undefined;
}

const explicitSkip = parseBoolean(process.env.SERVER_SKIP_WORKSPACE_ENV);
const forceWorkspaceEnv = parseBoolean(process.env.SERVER_REQUIRE_WORKSPACE_ENV) ?? false;
const defaultSkip = process.env.NODE_ENV === "production";
const skipWorkspaceEnv = explicitSkip ?? defaultSkip;

const appEnvFiles = [
	resolve(appRoot, ".env.local"),
	resolve(appRoot, ".env"),
];

const workspaceEnvFiles = [
	resolve(workspaceRoot, ".env.local"),
	resolve(workspaceRoot, ".env"),
];

const loaded = new Set<string>();

function loadFiles(files: string[]) {
	for (const file of files) {
		if (loaded.has(file) || !existsSync(file)) continue;
		loaded.add(file);
		loadEnv({ path: file, override: false });
	}
}

loadFiles(appEnvFiles);

const criticalKeys = [
	"DATABASE_URL",
	"SHADOW_DATABASE_URL",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"SERVER_INTERNAL_URL",
	"CORS_ORIGIN",
];

const missingCritical = criticalKeys.filter((key) => !process.env[key]);
const shouldLoadWorkspaceEnv = !skipWorkspaceEnv || forceWorkspaceEnv || missingCritical.length > 0;

if (shouldLoadWorkspaceEnv) {
	loadFiles(workspaceEnvFiles);
	if (missingCritical.length > 0 && skipWorkspaceEnv && !forceWorkspaceEnv) {
		console.warn(
			`[server:env] Loaded workspace-level .env to supply missing vars: ${missingCritical.join(", ")}`,
		);
	}
}
