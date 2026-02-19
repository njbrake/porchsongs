import { useState } from 'react';
import api from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(password);
      localStorage.setItem('porchsongs_app_secret', token);
      onLogin();
    } catch {
      setError('Wrong password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="p-8 sm:p-10 w-full max-w-[360px] mx-4 text-center flex flex-col items-center gap-3 shadow-md">
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-3">
          <img src="/logo.svg" alt="" className="w-16 h-16 mb-1" />
          <h1 className="text-2xl font-bold text-foreground">porchsongs</h1>
          <p className="text-sm text-muted-foreground mb-2">Enter the password to continue</p>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="text-center"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full mt-1" disabled={loading || !password.trim()}>
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
