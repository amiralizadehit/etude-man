import { authClient } from "@/lib/authClient";
import ExerciseListPage from "@/pages/ExerciseListPage";
import LoginPage from "@/pages/LoginPage";

export default function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p className="p-4">Loading…</p>;
  }
  if (!session) {
    return <LoginPage />;
  }
  return <ExerciseListPage userEmail={session.user.email} />;
}
