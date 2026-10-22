import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

const SERVICE_OPTIONS = new Set(['weddings', 'proposal', 'lessons', 'recording', 'other']);
const MAX_BODY_BYTES = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[\u0000-\u001F\u007F]/g, '');
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

function optionalText(value: unknown, max: number): string | null | 'invalid' {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return 'invalid';
  const cleaned = value.trim().replace(/[\u0000-\u001F\u007F]/g, '');
  if (cleaned.length > max) return 'invalid';
  return cleaned || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'That message is too long.' }, { status: 413 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const name = requiredText(body.name, 200);
    const email = requiredText(body.email, 255)?.toLowerCase() ?? null;
    const phone = optionalText(body.phone, 50);
    const service = requiredText(body.service, 50);
    const packageInterest = optionalText(body.package, 100);
    const eventDate = optionalText(body.eventDate, 10);
    const message = requiredText(body.message, 5000);
    const privacy = body.privacy === true;

    const emailLooksValid = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    const phoneLooksValid =
      phone === null || (phone !== 'invalid' && /^[0-9+().\-\s]{7,50}$/.test(phone));
    const dateLooksValid =
      eventDate === null || (eventDate !== 'invalid' && /^\d{4}-\d{2}-\d{2}$/.test(eventDate));

    if (
      !name ||
      !emailLooksValid ||
      !service ||
      !SERVICE_OPTIONS.has(service) ||
      !message ||
      !privacy ||
      phone === 'invalid' ||
      !phoneLooksValid ||
      packageInterest === 'invalid' ||
      eventDate === 'invalid' ||
      !dateLooksValid
    ) {
      return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const normalizedEmail = email as string;

    const { data: existingClient, error: lookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      console.error('Failed to look up client');
      return NextResponse.json(
        { error: 'Failed to save your information. Please try again.' },
        { status: 500 }
      );
    }

    let clientId = existingClient?.id as string | undefined;

    if (!clientId) {
      const { data: createdClient, error: createError } = await supabase
        .from('clients')
        .insert({
          email: normalizedEmail,
          name,
          phone,
        })
        .select('id')
        .single();

      if (createError?.code === '23505') {
        const { data: racedClient, error: racedError } = await supabase
          .from('clients')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle();
        if (racedError || !racedClient) {
          console.error('Failed to recover client after a duplicate email');
          return NextResponse.json(
            { error: 'Failed to save your information. Please try again.' },
            { status: 500 }
          );
        }
        clientId = racedClient.id;
      } else if (createError || !createdClient) {
        console.error('Failed to create client');
        return NextResponse.json(
          { error: 'Failed to save your information. Please try again.' },
          { status: 500 }
        );
      } else {
        clientId = createdClient.id;
      }
    }

    const { error: leadError } = await supabase.from('leads').insert({
      client_id: clientId,
      status: 'New Inquiry',
      event_date: eventDate,
      service_type: service,
      package_interest: packageInterest,
      message,
    });

    if (leadError) {
      console.error('Failed to create lead');
      return NextResponse.json(
        { error: 'Failed to save your inquiry. Please try again.' },
        { status: 500 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(normalizedEmail);
      const safePhone = escapeHtml(phone || 'Not provided');
      const safeService = escapeHtml(service);
      const safePackage = escapeHtml(packageInterest || 'Not specified');
      const safeDate = escapeHtml(eventDate || 'Not specified');
      const safeMessage = escapeHtml(message);
      const from = process.env.RESEND_FROM_EMAIL || 'noreply@danielcimo.com';

      try {
        await resend.emails.send({
          from,
          to: normalizedEmail,
          subject: 'Thank you for your inquiry - Daniel Cimo Violin',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Thank you for your inquiry!</h2>
              <p>Hi ${safeName},</p>
              <p>Thank you for reaching out about ${safeService} services. I've received your message and will get back to you within 24-48 hours.</p>
              <p>Here's a summary of what you shared:</p>
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Service:</strong> ${safeService}</p>
                <p><strong>Package:</strong> ${safePackage}</p>
                <p><strong>Event Date:</strong> ${safeDate}</p>
              </div>
              <p>I look forward to discussing your special event with you!</p>
              <p>Best regards,<br>Daniel Cimo</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send client acknowledgment', emailError);
      }

      try {
        await resend.emails.send({
          from,
          to: process.env.CONTACT_EMAIL || 'dancimo@gmail.com',
          subject: `New ${service.replace(/[\r\n]+/g, ' ')} inquiry from ${name.replace(/[\r\n]+/g, ' ')}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">
                New Contact Form Submission
              </h2>
              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Phone:</strong> ${safePhone}</p>
                <p><strong>Service:</strong> ${safeService}</p>
                <p><strong>Package:</strong> ${safePackage}</p>
                <p><strong>Event Date:</strong> ${safeDate}</p>
              </div>
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #92400e; margin-top: 0;">Message:</h3>
                <p style="white-space: pre-wrap; line-height: 1.6;">${safeMessage}</p>
              </div>
              <div style="text-align: center; margin-top: 30px; padding: 20px; background: #1f2937; color: white; border-radius: 8px;">
                <p style="margin: 0;">This message was sent from your Daniel Cimo website contact form.</p>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send admin notification', emailError);
      }
    }

    return NextResponse.json(
      { success: true, message: 'Form submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
