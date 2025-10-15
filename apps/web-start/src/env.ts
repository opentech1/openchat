export const env = {
  APP_URL: import.meta.env.VITE_APP_URL ?? "http://localhost:3001",
  SERVER_URL: import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000",
  ELECTRIC_URL: import.meta.env.VITE_ELECTRIC_URL ?? "",
} as const;

