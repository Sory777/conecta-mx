import { AuthProvider, useAuth } from './lib/auth';
import { useRoute, type Route } from './lib/router';
import { Layout } from './components/Layout';
import { Spinner, ToastProvider } from './components/ui';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { NewCoursePage } from './pages/NewCoursePage';
import { DiagnosisPage } from './pages/DiagnosisPage';
import { PlanPage } from './pages/PlanPage';
import { CoursePage } from './pages/CoursePage';
import { LessonPage } from './pages/LessonPage';
import { QuizPage } from './pages/QuizPage';
import { TutorPage } from './pages/TutorPage';
import { ProjectPage } from './pages/ProjectPage';
import { ProgressPage } from './pages/ProgressPage';
import { LibraryPage } from './pages/LibraryPage';
import { ProfilePage } from './pages/ProfilePage';
import { CertificatePage } from './pages/CertificatePage';
import { SharedPage } from './pages/SharedPage';

const PUBLIC: Route['name'][] = ['home', 'login', 'register', 'certificate', 'shared'];

function Screen({ route }: { route: Route }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user && !PUBLIC.includes(route.name)) return <AuthPage mode="login" />;
  if (user && (route.name === 'login' || route.name === 'register')) return <HomePage />;
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'login':
      return <AuthPage mode="login" />;
    case 'register':
      return <AuthPage mode="register" />;
    case 'new':
      return <NewCoursePage key={route.q} q={route.q} />;
    case 'diagnosis':
      return <DiagnosisPage key={route.id} id={route.id} />;
    case 'plan':
      return <PlanPage key={route.id} id={route.id} />;
    case 'course':
      return <CoursePage key={route.id} id={route.id} />;
    case 'lesson':
      return <LessonPage key={route.id} id={route.id} />;
    case 'quiz':
      return <QuizPage key={route.id} id={route.id} />;
    case 'tutor':
      return <TutorPage key={route.id} id={route.id} lesson={route.lesson} />;
    case 'project':
      return <ProjectPage key={route.id} id={route.id} />;
    case 'progress':
      return <ProgressPage />;
    case 'library':
      return <LibraryPage />;
    case 'profile':
      return <ProfilePage />;
    case 'certificate':
      return <CertificatePage key={route.code} code={route.code} />;
    case 'shared':
      return <SharedPage key={route.code} code={route.code} />;
  }
}

export default function App() {
  const route = useRoute();
  return (
    <ToastProvider>
      <AuthProvider>
        <Layout route={route}>
          <Screen route={route} />
        </Layout>
      </AuthProvider>
    </ToastProvider>
  );
}
