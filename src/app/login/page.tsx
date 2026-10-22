import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Login</h1>
            <p className="text-gray-600">Daniel Cimo Violin - Booking Management</p>
          </div>

          <Suspense fallback={<p className="text-gray-600">Loading...</p>}>
            <LoginForm />
          </Suspense>

          <div className="mt-6 text-center">
            <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm">
              ← Back to website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
