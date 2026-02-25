import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { HOWTO_ARTICLES } from '@/data/howto-articles';

export default function HowToIndex() {
  return (
    <>
      <Helmet>
        <title>How-To Guides — porchsongs</title>
        <meta name="description" content="Learn how to use porchsongs with step-by-step guides for rewriting songs, refining with chat, and exporting PDFs." />
        <meta property="og:title" content="How-To Guides — porchsongs" />
        <meta property="og:description" content="Step-by-step guides for using porchsongs." />
      </Helmet>

      <section className="py-16 sm:py-24 px-4 max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8">[PLACEHOLDER] How-To Guides</h1>

        <div className="grid sm:grid-cols-2 gap-6">
          {HOWTO_ARTICLES.map(article => (
            <Link
              key={article.slug}
              to={`/how-to/${article.slug}`}
              className="bg-card border border-border rounded-lg p-6 no-underline hover:border-primary transition-colors group"
            >
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary mb-2">
                {article.title}
              </h3>
              <p className="text-sm text-muted-foreground">{article.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
