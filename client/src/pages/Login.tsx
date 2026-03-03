import * as Label from "@radix-ui/react-label";
import { useState } from "react";
import { useLogin } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      setLocation("/");
    } catch {
      // error shown below
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">Login</h1>

        <div className="space-y-1">
          <Label.Root
            htmlFor="email"
            className="text-sm font-medium leading-none"
          >
            Email
          </Label.Root>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label.Root
            htmlFor="password"
            className="text-sm font-medium leading-none"
          >
            Password
          </Label.Root>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {login.isError && (
          <p className="text-sm text-red-600">
            {login.error instanceof Error
              ? login.error.message
              : "Login failed"}
          </p>
        )}

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Logging in..." : "Login"}
        </Button>
      </form>
    </div>
  );
}
