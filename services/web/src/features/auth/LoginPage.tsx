import { type FormEvent, useState } from 'react';
import { useLoginMutation } from '../../api/api.js';
import { describeError } from '../../api/errors.js';
import { useAppDispatch } from '../../app/hooks.js';
import { loggedIn } from './authSlice.js';

export const LoginPage = () => {
  const dispatch = useAppDispatch();
  const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const { token, user } = await login({ email, password }).unwrap();
      dispatch(loggedIn({ token, email: user.email, tenantId: user.tenantId }));
    } catch {
      // The hook's `error` already holds the failure; it's rendered below.
    }
  };

  const message =
    error === undefined
      ? null
      : 'status' in error && error.status === 401
        ? 'Wrong email or password.'
        : `Could not sign in: ${describeError(error)}`;

  return (
    <main className="login">
      <form className="login-panel" onSubmit={onSubmit}>
        <div className="login-heading">
          <span className="wordmark">mqtt-thing</span>
          <h1>Sign in</h1>
        </div>

        <label className="field">
          <span className="label">EMAIL</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">PASSWORD</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {message !== null && (
          <p className="error login-error" role="alert">
            {message}
          </p>
        )}

        <button className="button" type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
};
