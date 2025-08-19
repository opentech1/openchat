import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function Dashboard() {
  return (
    <div>
      <h1>Hello World</h1>
      <p>Welcome to the dashboard!</p>
    </div>
  );
}
