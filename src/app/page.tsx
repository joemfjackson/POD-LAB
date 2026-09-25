import { redirect } from "next/navigation";
import { getUser } from "@/server/context";

export default async function Home() {
  const session = await getUser();
  redirect(session ? "/dashboard" : "/login");
}
