import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/authClient";
import bachSketch from "../../../assets/bach.jpg";

const SIGN_IN_FAILED = "Sign-in failed. Please try again.";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setErrorMessage(error.status === 401 ? "Wrong email or password." : SIGN_IN_FAILED);
      }
    } catch {
      // Network failure: the request never got a response.
      setErrorMessage(SIGN_IN_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <div className="hidden items-end justify-end overflow-hidden md:flex">
        <img src={bachSketch} alt="" className="sketch h-[86vh] max-h-[52rem] w-auto object-contain object-bottom" />
      </div>
      <div className="flex items-center px-4 py-12 md:px-12">
        <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
          <h1 className="mb-6 text-6xl lg:text-7xl">Etude Man</h1>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {errorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} size="lg" className="mt-2">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
