import { redirect } from "next/navigation";

export default function AuthIndexPage() {
	redirect("/auth/sign-in");
}
export const dynamic = "force-dynamic";
