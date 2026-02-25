import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    features: [
      '10 rewrites per month',
      'Song library',
      'PDF export',
      'Chat refinement',
    ],
    cta: 'Get Started',
    ctaTo: '/app/rewrite',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$8',
    period: '/mo',
    features: [
      '200 rewrites per month',
      'Everything in Free',
      'Priority processing',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
    ctaTo: '/app/settings/account',
    highlight: true,
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <Helmet>
        <title>Pricing — porchsongs</title>
        <meta name="description" content="Simple pricing for porchsongs. Free plan with 10 rewrites/mo. Pro plan with 200 rewrites/mo for $8/mo." />
        <meta property="og:title" content="Pricing — porchsongs" />
        <meta property="og:description" content="Simple pricing for song rewriting. Start free, upgrade when you need more." />
      </Helmet>

      <section className="py-16 sm:py-24 px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">[PLACEHOLDER] Simple, transparent pricing</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-12">
          [PLACEHOLDER] Start for free. Upgrade when you need more rewrites.
        </p>

        <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-6">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`bg-card border rounded-lg p-6 sm:p-8 text-left flex flex-col ${
                plan.highlight ? 'border-primary shadow-lg' : 'border-border'
              }`}
            >
              <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="flex-1 mb-6 space-y-2">
                {plan.features.map(f => (
                  <li key={f} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.ctaTo}
                className={`text-center px-4 py-2.5 rounded-md text-sm font-semibold no-underline transition-colors ${
                  plan.highlight
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-panel text-foreground border border-border hover:bg-card'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
