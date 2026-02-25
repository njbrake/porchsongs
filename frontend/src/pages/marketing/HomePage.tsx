import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <>
      <title>porchsongs — Make every song yours</title>
      <meta name="description" content="Rewrite song lyrics to match your vocal range and style. AI-powered chord transposition and lyric adaptation." />
      <meta property="og:title" content="porchsongs — Make every song yours" />
      <meta property="og:description" content="Rewrite song lyrics to match your vocal range and style." />
      <meta property="og:type" content="website" />

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-foreground">
          Make every song yours
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          [PLACEHOLDER] Paste any song lyrics and let AI rewrite them to match your voice, range, and style. Perfect for worship leaders, cover artists, and performers.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            to="/app/rewrite"
            className="bg-primary text-white px-6 py-3 rounded-full text-base font-semibold no-underline hover:opacity-90 transition-opacity"
          >
            Get Started Free
          </Link>
          <Link
            to="/pricing"
            className="border border-border text-foreground px-6 py-3 rounded-full text-base font-semibold no-underline hover:bg-panel transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-12 px-4 bg-panel">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-3xl mb-3">&#9835;</div>
            <h3 className="text-lg font-semibold mb-2">[PLACEHOLDER] Smart Rewriting</h3>
            <p className="text-sm text-muted-foreground">
              [PLACEHOLDER] AI understands song structure, chord progressions, and lyric meter to produce singable rewrites.
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-3xl mb-3">&#128172;</div>
            <h3 className="text-lg font-semibold mb-2">[PLACEHOLDER] Iterative Chat</h3>
            <p className="text-sm text-muted-foreground">
              [PLACEHOLDER] Not happy with a verse? Chat with the AI to refine specific sections until they&apos;re perfect.
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-3xl mb-3">&#128218;</div>
            <h3 className="text-lg font-semibold mb-2">[PLACEHOLDER] Song Library</h3>
            <p className="text-sm text-muted-foreground">
              [PLACEHOLDER] Save and organize your rewrites into folders. Export as PDF for performance sheets.
            </p>
          </div>
        </div>
      </section>

      {/* Demo screenshot */}
      <section className="py-12 sm:py-16 px-4 text-center">
        <h2 className="text-2xl font-bold mb-6">[PLACEHOLDER] See it in action</h2>
        <div className="max-w-4xl mx-auto">
          <img
            src="/porchsongs-demo.gif"
            alt="porchsongs demo showing song rewriting"
            className="rounded-lg shadow-lg border border-border w-full"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 px-4 text-center bg-panel">
        <h2 className="text-2xl font-bold mb-3">[PLACEHOLDER] Ready to start rewriting?</h2>
        <p className="text-muted-foreground mb-6">Free plan includes 10 rewrites per month.</p>
        <Link
          to="/app/rewrite"
          className="bg-primary text-white px-6 py-3 rounded-full text-base font-semibold no-underline hover:opacity-90 transition-opacity"
        >
          Get Started Free
        </Link>
      </section>
    </>
  );
}
