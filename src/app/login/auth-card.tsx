import Link from 'next/link';

export const authFieldClass =
  'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-500';

export const authLabelClass = 'block text-sm font-medium text-gray-700 mb-2';

export const authButtonClass =
  'w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-6 rounded-lg font-medium transition-colors';

export const authErrorClass = 'bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm';

export const authInfoClass = 'bg-blue-50 text-blue-900 px-4 py-3 rounded-lg text-sm';

export const authTextLinkClass = 'text-sm text-blue-600 hover:text-blue-700';

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
            <p className="text-gray-600">Daniel Cimo Violin - Booking Management</p>
          </div>

          {children}

          <div className="mt-6 text-center">
            <Link href="/" className={authTextLinkClass}>
              ← Back to website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthNotice({
  children,
  tone = 'error',
  id,
}: {
  children: React.ReactNode;
  tone?: 'error' | 'info';
  id?: string;
}) {
  return (
    <div id={id} className={tone === 'info' ? authInfoClass : authErrorClass} role={tone === 'info' ? 'status' : 'alert'}>
      {children}
    </div>
  );
}
