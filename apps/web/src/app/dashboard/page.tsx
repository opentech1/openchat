import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function Dashboard() {
  return (
    <div className="h-full w-full p-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to your dashboard!</p>
    </div>
  );
}
