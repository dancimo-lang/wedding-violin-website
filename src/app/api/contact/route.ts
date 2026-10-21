import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Create or find client in Supabase
    let clientId: string | null = null;
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .upsert({
          email: data.email,
          name: data.name,
          phone: data.phone || null,
        }, {
          onConflict: 'email'
        })
        .select()
        .single();

      if (clientError) throw clientError;
      clientId = clientData.id;
    } catch (error) {
      console.error('Failed to create client:', error);
      return NextResponse.json(
        { error: 'Failed to save your information. Please try again.' },
        { status: 500 }
      );
    }

    // Create lead in Supabase
    try {
      await supabase.from('leads').insert({
        client_id: clientId,
        status: 'New Inquiry',
        event_date: data.eventDate || null,
        service_type: data.service,
        package_interest: data.package || null,
        message: data.message,
      });
    } catch (error) {
      console.error('Failed to create lead:', error);
      return NextResponse.json(
        { error: 'Failed to save your inquiry. Please try again.' },
        { status: 500 }
      );
    }

    // Send acknowledgment email to client
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@danielcimo.com',
        to: data.email,
        subject: 'Thank you for your inquiry - Daniel Cimo Violin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1f2937;">Thank you for your inquiry!</h2>
            <p>Hi ${data.name},</p>
            <p>Thank you for reaching out about ${data.service} services. I've received your message and will get back to you within 24-48 hours.</p>
            <p>Here's a summary of what you shared:</p>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Service:</strong> ${data.service}</p>
              <p><strong>Package:</strong> ${data.package || 'Not specified'}</p>
              <p><strong>Event Date:</strong> ${data.eventDate || 'Not specified'}</p>
            </div>
            <p>I look forward to discussing your special event with you!</p>
            <p>Best regards,<br>Daniel Cimo</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send client acknowledgment:', emailError);
    }

    // Send notification email to admin
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@danielcimo.com',
        to: process.env.CONTACT_EMAIL || 'dancimo@gmail.com',
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
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
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
