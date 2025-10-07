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

function normalizeUrl(value: string | undefined) {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	if (trimmed === "") return undefined;
	return trimmed.replace(/\/+$/, "");
}

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

const normalizedBetterAuthUrl = normalizeUrl(process.env.BETTER_AUTH_URL);
if (normalizedBetterAuthUrl) {
	process.env.BETTER_AUTH_URL = normalizedBetterAuthUrl;
} else if (process.env.BETTER_AUTH_URL) {
	delete process.env.BETTER_AUTH_URL;
}

const normalizedPublicServerUrl = normalizeUrl(process.env.NEXT_PUBLIC_SERVER_URL);
if (normalizedPublicServerUrl) {
	process.env.NEXT_PUBLIC_SERVER_URL = normalizedPublicServerUrl;
} else if (process.env.NEXT_PUBLIC_SERVER_URL) {
	delete process.env.NEXT_PUBLIC_SERVER_URL;
}

const normalizedInternalUrl = normalizeUrl(process.env.SERVER_INTERNAL_URL);
if (normalizedInternalUrl) {
	process.env.SERVER_INTERNAL_URL = normalizedInternalUrl;
} else {
	const fallbackInternalUrl = normalizedBetterAuthUrl ?? normalizedPublicServerUrl;
	if (fallbackInternalUrl) {
		process.env.SERVER_INTERNAL_URL = fallbackInternalUrl;
	}
}

const criticalKeys = [
	"DATABASE_URL",
	"SHADOW_DATABASE_URL",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"SERVER_INTERNAL_URL",
	"CORS_ORIGIN",
];

const shouldLoadWorkspaceEnv = forceWorkspaceEnv || !skipWorkspaceEnv;
if (shouldLoadWorkspaceEnv) {
	loadFiles(workspaceEnvFiles);
}

const unresolvedCritical = criticalKeys.filter((key) => !process.env[key]);
if (unresolvedCritical.length > 0) {
	const hint = skipWorkspaceEnv && !forceWorkspaceEnv
		? "Set them in the runtime environment or export SERVER_REQUIRE_WORKSPACE_ENV=1 to allow workspace-level .env fallbacks."
		: "Populate them in the app's .env file or provide them at runtime.";
	const message = `[server:env] Missing required environment variables: ${unresolvedCritical.join(", ")}. ${hint}`;
	if (process.env.NODE_ENV === "production") {
		throw new Error(message);
	}
	if (process.env.NODE_ENV !== "test") {
		console.warn(message);
	}
}
