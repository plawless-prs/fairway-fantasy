import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-clubhouse-950">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
