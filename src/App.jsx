import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeagueCreate from './pages/LeagueCreate';
import LeagueView from './pages/LeagueView';
import MyTeam from './pages/MyTeam';
import FreeAgents from './pages/FreeAgents';
import Draft from './pages/Draft';
import Commissioner from './pages/Commissioner';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-clubhouse-400 font-display text-xl">Loading...</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Home />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/league/create" element={<ProtectedRoute><Layout><LeagueCreate /></Layout></ProtectedRoute>} />
      <Route path="/league/:id" element={<ProtectedRoute><Layout><LeagueView /></Layout></ProtectedRoute>} />
      <Route path="/league/:id/team" element={<ProtectedRoute><Layout><MyTeam /></Layout></ProtectedRoute>} />
      <Route path="/league/:id/free-agents" element={<ProtectedRoute><Layout><FreeAgents /></Layout></ProtectedRoute>} />
      <Route path="/league/:id/draft" element={<ProtectedRoute><Layout><Draft /></Layout></ProtectedRoute>} />
      <Route path="/league/:id/commissioner" element={<ProtectedRoute><Layout><Commissioner /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#362f26',
              color: '#f0ede8',
              border: '1px solid #4a4134',
              fontFamily: '"DM Sans", system-ui, sans-serif',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
