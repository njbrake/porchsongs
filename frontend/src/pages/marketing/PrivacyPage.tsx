export default function PrivacyPage() {
  return (
    <>
      <title>Privacy Policy — porchsongs</title>
      <meta name="description" content="Privacy Policy for porchsongs, operated by Brake Labs LLC." />

      <section className="py-16 sm:py-24 px-4 max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: February 25, 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed text-sm">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Introduction</h2>
            <p>
              Brake Labs LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
              operates the porchsongs service (&quot;Service&quot;). This Privacy Policy explains
              what information we collect, how we use it, and your choices regarding your data.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Information We Collect</h2>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Account Information</h3>
            <p>
              When you sign in with Google OAuth, we receive your name, email address, and profile
              picture from Google. We use this to create and manage your account.
            </p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Content You Provide</h3>
            <p>
              Song lyrics, chord charts, and other content you input into the Service for rewriting
              and storage in your song library.
            </p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Usage Data</h3>
            <p>
              We collect basic usage information such as the number of rewrites performed, features
              used, and general interaction patterns. This helps us improve the Service.
            </p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Payment Information</h3>
            <p>
              Payment processing is handled by Stripe. We do not store your credit card number or
              full payment details on our servers. Stripe may collect information as described in
              their privacy policy.
            </p>

            <h3 className="text-base font-semibold text-foreground mt-4 mb-1">Technical Data</h3>
            <p>
              We may collect IP addresses, browser type, device information, and access times through
              server logs and cookies.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide, maintain, and improve the Service</li>
              <li>To process your subscription and payments</li>
              <li>To send transactional emails (e.g., billing receipts, account notifications)</li>
              <li>To respond to support requests</li>
              <li>To monitor usage for quota enforcement and abuse prevention</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-foreground">not</strong> sell your personal information.
              We do <strong className="text-foreground">not</strong> use your song content to train
              AI models.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Third-Party Services</h2>
            <p className="mb-3">We share information with the following third-party services as necessary to operate:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Google</strong> — for OAuth authentication</li>
              <li><strong className="text-foreground">Stripe</strong> — for payment processing</li>
              <li><strong className="text-foreground">AI providers</strong> — song content is sent to
                third-party AI model providers (e.g., Anthropic, OpenAI) for rewriting. Content is
                sent per the provider&apos;s API terms and is not used by them for model training
                under their API agreements.</li>
            </ul>
            <p className="mt-3">
              We do not share your personal information with any other third parties except as
              required by law.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Cookies</h2>
            <p className="mb-3">We use a limited number of cookies:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Authentication cookies</strong> — to keep you
                signed in (essential, session-based)</li>
              <li><strong className="text-foreground">CSRF cookies</strong> — to protect against
                cross-site request forgery during OAuth (essential)</li>
            </ul>
            <p className="mt-3">
              We do not use advertising or tracking cookies. We do not use third-party analytics
              services that set cookies.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Data Retention</h2>
            <p>
              We retain your account data and song library for as long as your account is active.
              If you delete your account, we will delete your personal data and song content within
              30 days, except where we are required to retain data for legal or compliance purposes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Data Security</h2>
            <p>
              We use industry-standard security measures to protect your data, including encrypted
              connections (HTTPS/TLS), secure authentication, and access controls. However, no method
              of transmission over the internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Your Rights</h2>
            <p className="mb-3">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of certain data processing</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:placeholder@placeholder.com" className="text-primary hover:underline">
                placeholder@placeholder.com
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have the right to know what personal information
              we collect, request its deletion, and opt out of its sale. As stated above, we do not
              sell personal information. To make a request, contact us at placeholder@placeholder.com.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for children under 13. We do not knowingly collect personal
              information from children under 13. If we learn we have collected such information, we
              will delete it promptly.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the updated policy on this page and updating the &quot;Last
              updated&quot; date. Continued use of the Service after changes constitutes acceptance.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Contact</h2>
            <p>
              Questions about this Privacy Policy? Contact us at{' '}
              <a href="mailto:placeholder@placeholder.com" className="text-primary hover:underline">
                placeholder@placeholder.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
