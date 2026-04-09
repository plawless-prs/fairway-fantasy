import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, displayName);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Account created! Check your email to confirm.');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        navigate('/dashboard');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Background */}
      <div className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 40%, rgba(30, 122, 30, 0.4) 0%, transparent 50%),
                            radial-gradient(circle at 70% 60%, rgba(200, 149, 46, 0.2) 0%, transparent 40%)`,
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-fairway-600 flex items-center justify-center shadow-lg">
            <span className="text-xl">⛳</span>
          </div>
          <span className="font-display text-2xl font-bold text-clubhouse-100">Fairway Fantasy</span>
        </Link>

        {/* Card */}
        <div className="card border-clubhouse-700 p-8">
          <h2 className="font-display text-2xl font-bold text-clubhouse-100 mb-1">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-clubhouse-500 mb-6">
            {isSignUp ? 'Join the course and start competing.' : 'Sign in to manage your leagues.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-clubhouse-400 mb-1.5">Display Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clubhouse-500" />
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder="Tiger Woods Jr."
                    className="input-field pl-10" required />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-clubhouse-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clubhouse-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-10" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-clubhouse-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clubhouse-500" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10" required minLength={6} />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm">
              {loading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-clubhouse-400 hover:text-fairway-400 transition-colors">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
