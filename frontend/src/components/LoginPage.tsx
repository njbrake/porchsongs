import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { authConfig } = useAuth();
  const navigate = useNavigate();
  const [loading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const method = authConfig?.method ?? 'none';

  // In premium mode the only login method is Google OAuth
  if (method === 'oauth_google') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 sm:p-10 w-full max-w-[360px] mx-4 text-center flex flex-col items-center gap-3 shadow-md">
          <img src="/logo.svg" alt="" className="w-16 h-16 mb-1" />
          <h1 className="text-2xl font-bold text-foreground">porchsongs</h1>
          <p className="text-sm text-muted-foreground mb-2">Sign in to continue</p>
          <label className="flex items-start gap-2 text-left text-sm text-muted-foreground cursor-pointer">
            <Checkbox
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              aria-label="Accept Terms and Privacy Policy"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </span>
          </label>
          <Button
            className="w-full mt-1"
            disabled={loading || !termsAccepted}
            onClick={() => { window.location.href = '/api/auth/oauth/google'; }}
          >
            Sign in with Google
          </Button>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground underline mt-2">
            Back to homepage
          </a>
        </Card>
      </div>
    );
  }

  // Fallback: redirect to app if no auth needed
  navigate('/app', { replace: true });
  return null;
}
