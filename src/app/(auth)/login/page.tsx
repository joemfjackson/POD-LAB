import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { magicLinkAction, signInAction } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      {error ? (
        <p role="alert" className="mb-3 text-xs text-critical-ink">
          {error}
        </p>
      ) : null}
      <AuthForm mode="login" action={signInAction} magicAction={magicLinkAction} next={next} />
    </>
  );
}
