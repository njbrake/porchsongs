export default function AboutPage() {
  return (
    <>
      <title>About — porchsongs</title>
      <meta name="description" content="Learn about porchsongs — an AI-powered tool for rewriting song lyrics to match your vocal range and style." />
      <meta property="og:title" content="About — porchsongs" />
      <meta property="og:description" content="AI-powered song rewriting for musicians and worship leaders." />

      <section className="py-16 sm:py-24 px-4 max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">About porchsongs</h1>

        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <p>
            porchsongs is an AI-powered tool that helps musicians, worship leaders, and
            performers rewrite song lyrics to match their unique voice, range, and style.
          </p>
          <p>
            Whether you need to transpose chords, simplify complex arrangements, or
            adapt lyrics for a different context, porchsongs makes it easy with intelligent
            rewriting that understands song structure and musical theory.
          </p>
          <p>
            Built by musicians, for musicians. We believe every performer should be
            able to make any song their own.
          </p>
        </div>
      </section>
    </>
  );
}
