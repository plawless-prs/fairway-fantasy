import { Link } from 'react-router-dom';
import { Trophy, Users, ArrowRight, Shield, BarChart3, ArrowLeftRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-clubhouse-950 overflow-hidden">
      {/* Hero */}
      <div className="relative">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(30, 122, 30, 0.3) 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, rgba(200, 149, 46, 0.2) 0%, transparent 40%)`,
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-fairway-600 shadow-2xl shadow-fairway-900/50 mb-8 animate-fade-in-up">
              <span className="text-3xl">⛳</span>
            </div>

            <h1 className="font-display text-5xl sm:text-7xl font-extrabold text-clubhouse-50 tracking-tight animate-fade-in-up stagger-1">
              Fairway Fantasy
            </h1>

            <p className="mt-5 text-lg sm:text-xl text-clubhouse-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up stagger-2">
              The ultimate fantasy golf platform. Draft golfers from the Official World Golf Rankings,
              manage your roster, trade with friends, and compete for the green jacket.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up stagger-3">
              <Link to="/login" className="btn-primary text-base px-8 py-3 flex items-center gap-2 shadow-xl">
                Get Started <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="btn-secondary text-base px-8 py-3">
                Join a League
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Shield size={24} />,
              title: 'Commissioner Controls',
              desc: 'Full control over league rules, roster locks, scoring, and trade reviews. Your league, your rules.',
              color: 'text-sand-400',
              bg: 'bg-sand-900/20 border-sand-800/30',
            },
            {
              icon: <BarChart3 size={24} />,
              title: 'Live Scoring',
              desc: 'Points from real PGA Tour tournaments. Track standings in real-time across H2H or season-long formats.',
              color: 'text-fairway-400',
              bg: 'bg-fairway-900/20 border-fairway-800/30',
            },
            {
              icon: <ArrowLeftRight size={24} />,
              title: 'Trades & Waivers',
              desc: 'Propose trades, pick up free agents, and use waiver priority. Multiple waiver systems including FAAB.',
              color: 'text-clubhouse-300',
              bg: 'bg-clubhouse-800/30 border-clubhouse-700/40',
            },
          ].map((feature, i) => (
            <div key={i}
              className={`rounded-2xl border p-7 ${feature.bg} animate-fade-in-up`}
              style={{ animationDelay: `${300 + i * 100}ms` }}>
              <div className={`${feature.color} mb-4`}>{feature.icon}</div>
              <h3 className="font-display text-lg font-bold text-clubhouse-100 mb-2">{feature.title}</h3>
              <p className="text-sm text-clubhouse-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-clubhouse-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-clubhouse-600">
          Fairway Fantasy — Player data based on Official World Golf Rankings
        </div>
      </footer>
    </div>
  );
}
