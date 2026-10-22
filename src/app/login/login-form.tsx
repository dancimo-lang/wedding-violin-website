'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initialState: LoginState = { error: '' };

export function LoginForm({ nextPath, notice }: { nextPath: string; notice: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const message = state.error || notice;

  return (
    <form action={formAction} className="space-y-6 admin-readable">
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-500"
          placeholder="dancimo@gmail.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-500"
          placeholder="••••••••"
        />
      </div>

      {message && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{message}</div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-6 rounded-lg font-medium transition-colors"
      >
        {pending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
