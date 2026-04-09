import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-clubhouse-950/90 backdrop-blur-md border-b border-clubhouse-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-full bg-fairway-600 flex items-center justify-center
                          group-hover:bg-fairway-500 transition-colors shadow-lg shadow-fairway-900/40">
              <span className="text-white text-sm font-bold">⛳</span>
            </div>
            <span className="font-display text-xl font-bold text-clubhouse-100 tracking-tight
                           hidden sm:block">
              Fairway Fantasy
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/dashboard"
              className="text-sm text-clubhouse-400 hover:text-clubhouse-100 transition-colors font-medium">
              My Leagues
            </Link>
            <Link to="/league/create"
              className="text-sm text-clubhouse-400 hover:text-clubhouse-100 transition-colors font-medium">
              Create League
            </Link>
            <div className="w-px h-6 bg-clubhouse-800" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-clubhouse-800 flex items-center justify-center border border-clubhouse-700">
                <User size={14} className="text-clubhouse-400" />
              </div>
              <span className="text-sm text-clubhouse-300 font-medium">
                {profile?.display_name || 'Player'}
              </span>
              <button onClick={handleSignOut}
                className="p-2 text-clubhouse-500 hover:text-red-400 transition-colors rounded-lg
                         hover:bg-clubhouse-900">
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* Mobile menu toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-clubhouse-400">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-clubhouse-800 bg-clubhouse-950 animate-fade-in-up">
          <div className="px-4 py-4 space-y-3">
            <Link to="/dashboard" onClick={() => setMenuOpen(false)}
              className="block text-sm text-clubhouse-300 hover:text-white py-2">My Leagues</Link>
            <Link to="/league/create" onClick={() => setMenuOpen(false)}
              className="block text-sm text-clubhouse-300 hover:text-white py-2">Create League</Link>
            <hr className="border-clubhouse-800" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-clubhouse-400">{profile?.display_name}</span>
              <button onClick={handleSignOut} className="text-sm text-red-400 hover:text-red-300">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
