import { useState } from 'react';
import api from '../api';

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
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.svg" alt="" className="login-logo" />
        <h1 className="login-title">porchsongs</h1>
        <p className="login-subtitle">Enter the password to continue</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="login-input"
        />
        {error && <p className="login-error">{error}</p>}
        <button className="btn primary login-btn" disabled={loading || !password.trim()}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
