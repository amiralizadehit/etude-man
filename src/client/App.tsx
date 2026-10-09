import { Navigate, Route, Routes } from "react-router";
import { authClient } from "@/lib/authClient";
import ExerciseListPage from "@/pages/ExerciseListPage";
import LoginPage from "@/pages/LoginPage";
import PracticePage from "@/pages/PracticePage";
import ReportPage from "@/pages/ReportPage";

export default function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p className="p-4">Loading…</p>;
  }
  if (!session) {
    return <LoginPage />;
  }
  return (
    <Routes>
      <Route path="/" element={<ExerciseListPage userEmail={session.user.email} />} />
      <Route path="/exercises/:exerciseId" element={<PracticePage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
