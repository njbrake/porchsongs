import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <>
      <title>Terms of Service — porchsongs</title>
      <meta name="description" content="Terms of Service for porchsongs, operated by Brake Labs LLC." />

      <section className="py-16 sm:py-24 px-4 max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: February 25, 2026</p>

        <div className="space-y-8 text-muted-foreground leading-relaxed text-sm">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Agreement to Terms</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the
              porchsongs service (&quot;Service&quot;), operated by Brake Labs LLC
              (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating
              an account or using the Service, you agree to be bound by these Terms. If you do not
              agree, do not use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>
              porchsongs is an AI-powered tool that helps musicians rewrite song lyrics, transpose
              chords, and adapt arrangements. The Service is provided &quot;as is&quot; and
              &quot;as available.&quot;
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Accounts</h2>
            <p>
              You must provide accurate information when creating an account. You are responsible for
              maintaining the security of your account credentials and for all activity under your
              account. Notify us immediately at placeholder@placeholder.com if you suspect unauthorized
              access.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Subscriptions &amp; Billing</h2>
            <div className="space-y-3">
              <p>
                porchsongs offers a free tier and paid subscription plans. Details are available on
                our <Link to="/pricing" className="text-primary hover:underline">Pricing page</Link>.
              </p>
              <p>
                <strong className="text-foreground">Auto-renewal:</strong> Paid subscriptions
                automatically renew at the end of each billing period (monthly) unless you cancel
                before the renewal date. You will be charged the then-current rate for your plan.
              </p>
              <p>
                <strong className="text-foreground">Cancellation:</strong> You may cancel your
                subscription at any time from your account settings. Cancellation takes effect at the
                end of the current billing period — you retain access to paid features until then.
              </p>
              <p>
                <strong className="text-foreground">Refunds:</strong> Payments are generally
                non-refundable. If you believe you were charged in error, contact us at
                placeholder@placeholder.com within 30 days and we will review your request.
              </p>
              <p>
                <strong className="text-foreground">Price changes:</strong> We may change
                subscription prices with at least 30 days&apos; advance notice. Continued use after a
                price change constitutes acceptance.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Use automated means (bots, scrapers) to access the Service without permission</li>
              <li>Resell, sublicense, or redistribute the Service</li>
              <li>Use the Service to infringe on the intellectual property rights of others</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Intellectual Property</h2>
            <div className="space-y-3">
              <p>
                <strong className="text-foreground">Your content:</strong> You retain ownership of
                any original content you input into the Service (e.g., your own lyrics,
                arrangements). AI-generated outputs are provided for your use but may not be
                exclusively owned by any party.
              </p>
              <p>
                <strong className="text-foreground">Our service:</strong> The Service, its design,
                code, and branding are owned by Brake Labs LLC and protected by intellectual property
                laws.
              </p>
              <p>
                <strong className="text-foreground">Third-party content:</strong> You are responsible
                for ensuring you have the right to use any song lyrics, chords, or other content you
                input. We do not claim ownership of third-party content processed through the Service.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Copyright</h2>
            <p>
              We respect intellectual property rights. If you believe content on our Service infringes
              your copyright, please contact us at{' '}
              <a href="mailto:placeholder@placeholder.com" className="text-primary hover:underline">
                placeholder@placeholder.com
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
              WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
              WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, BRAKE LABS LLC SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
              PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY FOR
              ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID
              US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">10. Dispute Resolution</h2>
            <div className="space-y-3">
              <p>
                Any dispute arising from these Terms or the Service shall first be attempted to be
                resolved through informal negotiation by contacting us at placeholder@placeholder.com.
              </p>
              <p>
                If informal resolution fails, disputes shall be resolved through binding arbitration
                administered under the rules of the American Arbitration Association. Arbitration
                shall take place in the state where Brake Labs LLC is registered. You agree to waive
                any right to a jury trial or to participate in a class action.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">11. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time for violation of
              these Terms. You may delete your account at any time. Upon termination, your right to
              use the Service ceases immediately, though provisions that by their nature should
              survive (e.g., limitation of liability, dispute resolution) will remain in effect.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by
              posting the updated Terms on this page and updating the &quot;Last updated&quot; date.
              Continued use of the Service after changes constitutes acceptance.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State in which Brake Labs LLC is
              registered, without regard to conflict of law principles.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">14. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{' '}
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
