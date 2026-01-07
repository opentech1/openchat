declare global {
	interface Window {
		stonks?: {
			event: (name: string, props?: Record<string, string>) => void;
		};
	}
}

function sendEvent(name: string, props?: Record<string, string>) {
	if (typeof window !== "undefined" && window.stonks?.event) {
		window.stonks.event(name, props);
	}
}

export const analytics = {
	modelSwitched: (modelId: string) => {
		sendEvent("Model Switched", { model: modelId });
	},

	messageSent: (modelId: string) => {
		sendEvent("Message Sent", { model: modelId });
	},

	chatCreated: () => {
		sendEvent("Chat Created");
	},

	signedIn: () => {
		sendEvent("Signed In");
	},

	thinkingModeChanged: (effort: string) => {
		sendEvent("Thinking Mode Changed", { effort });
	},

	searchToggled: (enabled: boolean) => {
		sendEvent("Search Toggled", { enabled: enabled ? "true" : "false" });
	},
};
