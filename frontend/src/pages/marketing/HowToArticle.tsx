import { useParams, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { HOWTO_ARTICLES } from '@/data/howto-articles';

export default function HowToArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = HOWTO_ARTICLES.find(a => a.slug === slug);

  if (!article) {
    return (
      <section className="py-16 px-4 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <p className="text-muted-foreground mb-6">The article you&apos;re looking for doesn&apos;t exist.</p>
        <Link to="/how-to" className="text-primary hover:underline">
          Back to How-To Guides
        </Link>
      </section>
    );
  }

  return (
    <>
      <title>{article.title} — porchsongs</title>
      <meta name="description" content={article.excerpt} />
      <meta property="og:title" content={`${article.title} — porchsongs`} />
      <meta property="og:description" content={article.excerpt} />

      <article className="py-16 sm:py-24 px-4 max-w-3xl mx-auto">
        <Link to="/how-to" className="text-sm text-primary hover:underline mb-6 inline-block">
          &larr; All Guides
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">{article.title}</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed chat-markdown">
          <Markdown>{article.content}</Markdown>
        </div>
      </article>
    </>
  );
}
