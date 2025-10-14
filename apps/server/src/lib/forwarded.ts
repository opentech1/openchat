import { isIP } from "node:net";

export function extractForwardedToken(raw: string) {
	let token = raw.trim();
	if (!token) return null;
	if (token.toLowerCase().startsWith("for=")) {
		token = token.slice(4).trim();
	}
	const semicolonIndex = token.indexOf(";");
	if (semicolonIndex !== -1) {
		token = token.slice(0, semicolonIndex);
	}
	if (token.startsWith("\"") && token.endsWith("\"") && token.length >= 2) {
		token = token.slice(1, -1);
	}
	if (token.startsWith("[")) {
		const end = token.indexOf("]");
		if (end !== -1) {
			token = token.slice(1, end);
		}
	}
	if (token.includes(":")) {
		const ipv4PortMatch = token.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
		if (ipv4PortMatch) {
			token = ipv4PortMatch[1]!;
		} else if (token.indexOf(":") === token.lastIndexOf(":") && token.includes(".")) {
			token = token.split(":")[0]!;
		}
	}
	token = token.trim();
	return token.length > 0 ? token : null;
}

export function parseForwardedHeader(value: string | null) {
	if (!value) return null;
	for (const part of value.split(",")) {
		const token = extractForwardedToken(part);
		if (token && isIP(token)) {
			return token;
		}
	}
	return null;
}
