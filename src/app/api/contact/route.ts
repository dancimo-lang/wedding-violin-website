import { NextRequest, NextResponse } from 'next/server';

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

    // TODO: Implement actual email sending
    // Options:
    // 1. SendGrid: https://sendgrid.com/
    // 2. Resend: https://resend.com/
    // 3. Nodemailer with SMTP
    // 4. AWS SES
    //
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'noreply@danielcimo.com',
    //   to: 'contact@danielcimo.com',
    //   subject: `New ${data.service} inquiry from ${data.name}`,
    //   html: `
    //     <h2>New Contact Form Submission</h2>
    //     <p><strong>Name:</strong> ${data.name}</p>
    //     <p><strong>Email:</strong> ${data.email}</p>
    //     <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
    //     <p><strong>Service:</strong> ${data.service}</p>
    //     <p><strong>Package:</strong> ${data.package || 'Not specified'}</p>
    //     <p><strong>Event Date:</strong> ${data.eventDate || 'Not specified'}</p>
    //     <p><strong>Message:</strong></p>
    //     <p>${data.message}</p>
    //   `,
    // });

    // Log the submission for now (remove in production)
    console.log('Contact form submission:', {
      name: data.name,
      email: data.email,
      phone: data.phone,
      service: data.service,
      package: data.package,
      eventDate: data.eventDate,
      message: data.message.substring(0, 100) + '...',
    });

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
