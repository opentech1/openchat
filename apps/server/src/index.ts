import "./env";
import { createApp } from "./app";

const PORT = Number(process.env.PORT || 3000);

const app = createApp();

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
