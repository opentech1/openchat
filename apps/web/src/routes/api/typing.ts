import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { redis } from "@/lib/redis";

export const Route = createFileRoute("/api/typing")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const { chatId, userId, isTyping } = body;

					if (!chatId || !userId) {
						return json({ error: "chatId and userId required" }, { status: 400 });
					}

					if (!redis.isAvailable()) {
						return json({ ok: true });
					}

					await redis.typing.set(chatId, userId, !!isTyping);
					return json({ ok: true });
				} catch {
					return json({ error: "Failed to update typing status" }, { status: 500 });
				}
			},

			GET: async ({ request }) => {
				const url = new URL(request.url);
				const chatId = url.searchParams.get("chatId");

				if (!chatId) {
					return json({ error: "chatId required" }, { status: 400 });
				}

				if (!redis.isAvailable()) {
					return json({ users: [] });
				}

				const users = await redis.typing.getUsers(chatId);
				return json({ users });
			},
		},
	},
});
