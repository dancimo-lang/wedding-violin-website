'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';

export default function QRCodePage() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const url = 'https://danielcimo.com';
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#14171f',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    generateQRCode();
  }, []);

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = 'danielcimo-com-qrcode.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-cream py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-ink mb-4">
            QR Code Generator
          </h1>
          <p className="text-lg text-ink-body">
            Scan this QR code to visit danielcimo.com
          </p>
        </div>

        <div className="bg-cream-card rounded-2xl border border-cream-line p-8">
          <div className="flex flex-col items-center space-y-6">
            {isGenerating ? (
              <div className="animate-pulse">
                <div className="w-64 h-64 bg-gray-200 rounded-lg"></div>
              </div>
            ) : qrCodeUrl ? (
              <>
                <div className="relative">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code for danielcimo.com"
                    className="w-64 h-64 rounded-lg shadow-lg"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-gold text-charcoal px-3 py-1 rounded-full text-sm font-medium">
                    danielcimo.com
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-ink-soft">
                      This QR code links to:
                    </p>
                    <p className="text-lg font-medium text-ink">
                      https://danielcimo.com
                    </p>
                  </div>

                  <button
                    onClick={downloadQRCode}
                    className="inline-flex items-center space-x-2 bg-gold hover:bg-gold-hover text-charcoal px-6 py-3 rounded-full font-medium transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span>Download QR Code</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-ink-soft">Failed to generate QR code</p>
                <button
                  onClick={generateQRCode}
                  className="mt-4 bg-gold hover:bg-gold-hover text-charcoal px-6 py-2 rounded-full font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-gold-deep hover:text-gold-deeper font-medium transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
