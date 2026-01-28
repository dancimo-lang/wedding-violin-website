import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  service: string;
  package?: string;
  eventDate?: string;
  message: string;
  privacy: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const data: ContactFormData = await request.json();

    // Validate required fields
    if (!data.name || !data.email || !data.service || !data.message || !data.privacy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Initialize Resend
    console.log('Environment check:', {
      hasApiKey: !!process.env.RESEND_API_KEY,
      hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
      hasContactEmail: !!process.env.CONTACT_EMAIL,
    });

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email notification
    try {
      console.log('Attempting to send email...');
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@danielcimo.com',
        to: process.env.CONTACT_EMAIL || 'contact@danielcimo.com',
        subject: `New ${data.service} inquiry from ${data.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">
              New Contact Form Submission
            </h2>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${data.name}</p>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
              <p><strong>Service:</strong> ${data.service}</p>
              <p><strong>Package:</strong> ${data.package || 'Not specified'}</p>
              <p><strong>Event Date:</strong> ${data.eventDate || 'Not specified'}</p>
            </div>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0;">Message:</h3>
              <p style="white-space: pre-wrap; line-height: 1.6;">${data.message}</p>
            </div>
            <div style="text-align: center; margin-top: 30px; padding: 20px; background: #1f2937; color: white; border-radius: 8px;">
              <p style="margin: 0;">This message was sent from your Daniel Cimo website contact form.</p>
            </div>
          </div>
        `,
      });
      console.log('Email sent successfully:', result);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Continue with response even if email fails
    }

    return NextResponse.json(
      { success: true, message: 'Form submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
