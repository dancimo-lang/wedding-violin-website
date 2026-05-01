'use client';

import { useState } from 'react';
import QRCode from 'qrcode';

export default function BusinessCardPage() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const url = 'https://danielcimo.com';
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 150,
        margin: 1,
        color: {
          dark: '#1F2937',
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

  useState(() => {
    generateQRCode();
  });

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Business Card</h1>
          <p className="text-gray-600">Traditional front/back wallet-sized business cards (3.5" x 2")</p>
        </div>

        {/* Business Cards Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          
          {/* Front of Card */}
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="bg-amber-50 p-4 text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Front of Card</h2>
            </div>
            
            <div className="relative bg-white" style={{ width: '350px', height: '200px', margin: '0 auto' }}>
              {/* Logo Background */}
              <div className="absolute inset-0 opacity-10 flex items-center justify-center">
                <img
                  src="/images/logo.svg"
                  alt="Daniel Cimo Logo"
                  className="w-48 h-48 object-contain"
                />
              </div>
              
              {/* Card Content */}
              <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src="/images/logo.svg"
                      alt="Daniel Cimo Logo"
                      className="w-12 h-12 object-contain"
                    />
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">Daniel Cimo</h1>
                      <p className="text-sm text-amber-600 font-medium">Violin</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-600 mb-3">Professional Violinist</p>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div>
                      <span className="text-xs text-gray-700">Weddings & Ceremonies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div>
                      <span className="text-xs text-gray-700">Private Violin Lessons</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div>
                      <span className="text-xs text-gray-700">Studio Recording Sessions</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="text-xs text-gray-600">
                    <p>Serving Central Coast</p>
                    <p className="text-amber-600 font-medium">danielcimo.com</p>
                  </div>
                  {qrCodeUrl && (
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="w-12 h-12"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Back of Card */}
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="bg-amber-50 p-4 text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Back of Card</h2>
            </div>
            
            <div className="relative bg-gradient-to-br from-amber-600 to-amber-700" style={{ width: '350px', height: '200px', margin: '0 auto' }}>
              {/* Logo Background */}
              <div className="absolute inset-0 opacity-5 flex items-center justify-center">
                <img
                  src="/images/logo.svg"
                  alt="Daniel Cimo Logo"
                  className="w-48 h-48 object-contain"
                />
              </div>
              
              {/* Card Content */}
              <div className="relative z-10 p-6 h-full flex flex-col justify-center text-white">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold mb-1">Daniel Cimo Violin</h2>
                  <p className="text-amber-100 text-sm">Professional Violinist</p>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>contact@danielcimo.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>(805) 555-0123</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>San Luis Obispo, CA</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-amber-500">
                  <p className="text-xs text-amber-100 mb-2">Find me on social media:</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">IG:</span>
                      <span>@slo_wedding_violinist</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">YT:</span>
                      <span>@weddingviolinistslo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">FB:</span>
                      <span>facebook.com/danielcimoviolin</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Print Instructions */}
        <div className="mt-8 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
            <h3 className="font-semibold text-blue-900 mb-2">Print Instructions</h3>
            <p className="text-blue-700 text-sm mb-2">
              Use Ctrl+P (or Cmd+P) to print. Select "Save as PDF" for digital copies or choose your printer for physical cards.
            </p>
            <p className="text-blue-700 text-sm">
              <strong>Recommended:</strong> Print on cardstock paper, set margins to "None", and choose "Actual Size" for accurate 3.5" x 2" wallet-sized cards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
