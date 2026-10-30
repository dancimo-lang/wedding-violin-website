import { Suspense } from 'react';
import { AuthCard } from './auth-card';
import { LoginForm } from './login-form';

export default function AdminLoginPage() {
  return (
    <AuthCard title="Admin Login">
      <Suspense fallback={<p className="text-gray-600">Loading...</p>}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
