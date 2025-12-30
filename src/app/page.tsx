import Link from "next/link";
import {
  FaMusic,
  FaQrcode,
  FaUsers,
  FaYoutube,
  FaRocket,
} from "react-icons/fa";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-green-500 selection:text-black">
      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          JUKEBOX PARTY
        </div>
        <Link
          href="/player"
          className="bg-white text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition"
        >
          Launch Player
        </Link>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-8 max-w-4xl mx-auto">
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-10 duration-700">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight">
            Turn any screen <br />
            into a <span className="text-green-500">Party Jukebox.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Create a room, share the QR code, and let your friends queue songs
            directly from their phones. No apps required.
          </p>
        </div>

        <Link
          href="/player"
          className="group relative inline-flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full text-xl font-bold transition-all hover:shadow-[0_0_40px_rgba(34,197,94,0.6)]"
        >
          <FaRocket /> Start a Party
          <span className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 animate-pulse"></span>
        </Link>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mt-16 text-left">
          <FeatureCard
            icon={<FaYoutube className="text-red-500" />}
            title="YouTube Powered"
            desc="Access millions of songs and videos instantly from YouTube."
          />
          <FeatureCard
            icon={<FaQrcode className="text-blue-500" />}
            title="Instant Join"
            desc="Guests scan a QR code to join. No login or app download needed."
          />
          <FeatureCard
            icon={<FaUsers className="text-purple-500" />}
            title="Fair Queue"
            desc="Everyone gets a turn. Master DJ controls the flow."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-600 text-sm">
        Built with Next.js, PeerJS & Tailwind
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:bg-zinc-900 transition hover:border-zinc-700">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}
