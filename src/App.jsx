import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Landing from './pages/Landing';
import Workspace from './pages/Workspace';
import HowItWorks from './pages/HowItWorks';
import Methodology from './pages/Methodology';
import Data from './pages/Data';
import About from './pages/About';
import Validation from './pages/Validation';
import RiskModel from './pages/RiskModel';
import ExpertFeedback from './pages/ExpertFeedback';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/" element={<Landing />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/methodology" element={<Methodology />} />
      <Route path="/data" element={<Data />} />
      <Route path="/about" element={<About />} />
      <Route path="/validation" element={<Validation />} />
      <Route path="/risk-model" element={<RiskModel />} />
      <Route path="/expert-feedback" element={<ExpertFeedback />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App