/**
 * Test utilities for creating requests with proper headers
 */

/**
 * Creates a test Request with origin header set for CORS validation
 *
 * @param url - The URL for the request
 * @param init - Request initialization options
 * @returns Request with origin header included
 */
export function createTestRequest(url: string, init?: RequestInit): Request {
	return new Request(url, {
		...init,
		headers: {
			origin: "http://localhost:3000",
			...init?.headers,
		},
	});
}

/**
 * Creates a test POST request with JSON body and proper headers
 *
 * @param url - The URL for the request
 * @param body - The JSON body to send
 * @param init - Additional request initialization options
 * @returns POST Request with content-type and origin headers
 */
export function createTestPostRequest(
	url: string,
	body: unknown,
	init?: Omit<RequestInit, "method" | "body">
): Request {
	return createTestRequest(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...init?.headers,
		},
		body: JSON.stringify(body),
		...init,
	});
}

/**
 * Creates a test GET request with proper headers
 *
 * @param url - The URL for the request
 * @param init - Additional request initialization options
 * @returns GET Request with origin header
 */
export function createTestGetRequest(url: string, init?: Omit<RequestInit, "method">): Request {
	return createTestRequest(url, {
		method: "GET",
		...init,
	});
}
