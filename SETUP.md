# Daniel Cimo Violin - Booking System Setup Guide

This guide covers setting up the booking system locally and deploying to production.

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Resend account (free tier: 3,000 emails/month)
- Git

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Resend
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
CONTACT_EMAIL=your-email@gmail.com

# Vercel Blob (optional, for file storage)
BLOB_READ_WRITE_TOKEN=your-blob-token
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to https://supabase.com
2. Sign up and create a new project
3. Wait for the project to be ready (2-3 minutes)
4. Copy your project URL and keys from Settings → API

### 2. Run Database Migrations

1. Go to the Supabase SQL Editor
2. Run the migration files in order:

**First migration** (`supabase/migrations/001_initial_schema.sql`):
```sql
-- This creates all tables: clients, leads, bookings, contracts, payments, services, packages, notes, communications, availability_blocks, follow_up_tasks
-- Run this entire file in the SQL Editor
```

**Second migration** (`supabase/migrations/002_rls_policies.sql`):
```sql
-- This enables Row Level Security and creates policies
-- Only authenticated users can access data
-- Run this entire file in the SQL Editor
```

### 3. Create Admin User

1. Go to Authentication → Users
2. Click "Add User"
3. Enter your admin email and password
4. Click "Save"

## Resend Setup

### 1. Create Resend Account

1. Go to https://resend.com
2. Sign up for a free account
3. Go to API Keys → Create API Key
4. Name it "Daniel Cimo Website"
5. **Copy the key immediately** (you won't see it again)
6. Add it to your `.env.local` as `RESEND_API_KEY`

### 2. Configure Sender Domain

1. In Resend, go to Domains
2. Add your domain (e.g., `danielcimo.com`)
3. Follow the DNS verification steps
4. Once verified, use an email from your domain as `RESEND_FROM_EMAIL`

## Local Development

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

### Access the Admin Dashboard

1. Navigate to http://localhost:3000/login
2. Log in with your Supabase admin credentials
3. Access the dashboard at http://localhost:3000/admin

## Testing the System

### 1. Submit a Test Inquiry

1. Go to http://localhost:3000/booking
2. Fill out the form with test data
3. Submit the form

### 2. Verify Database Records

1. Go to Supabase → Table Editor
2. Check `clients` table - a new client should be created
3. Check `leads` table - a new lead with status "New Inquiry" should be created

### 3. Verify Emails

1. Check the client's email inbox - acknowledgment email should arrive
2. Check your admin email inbox - notification email should arrive

### 4. Test Admin Dashboard

1. Log in at http://localhost:3000/login
2. Navigate to Leads
3. Verify leads appear
4. Try editing status, adding notes, searching, and filtering

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial booking system"
git push origin main
```

### 2. Deploy to Vercel

1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your GitHub repository
4. Add environment variables in Vercel settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `CONTACT_EMAIL`
5. Click "Deploy"

### 3. Configure Custom Domain (Optional)

1. In Vercel project settings, add your custom domain
2. Update DNS records as instructed by Vercel
3. Your site will be live at your domain

## Database Schema Overview

### Tables

- **clients**: Client information (name, email, phone)
- **leads**: Inquiry tracking (status, service type, event date, message)
- **bookings**: Confirmed bookings (venue, times, pricing)
- **contracts**: Contract documents and signatures
- **payments**: Payment tracking
- **services**: Service types (weddings, lessons, recording)
- **packages**: Pricing packages
- **notes**: Notes attached to leads
- **communications**: Email/phone communication log
- **availability_blocks**: Calendar availability
- **follow_up_tasks**: Task reminders

### Lead Status Workflow

1. New Inquiry
2. Needs Information
3. Quote Sent
4. Awaiting Response
5. Contract Sent
6. Awaiting Retainer
7. Lost

## Troubleshooting

### Login Not Working

- Ensure Supabase client is configured with localStorage persistence
- Check that your user exists in Supabase Authentication → Users
- Verify environment variables are set correctly

### Leads Not Showing

- Ensure session is persisted (check localStorage)
- Verify RLS policies are applied (run migration 002)
- Check browser console for errors

### Emails Not Sending

- Verify Resend API key is correct
- Check Resend logs for delivery status
- Ensure sender domain is verified in Resend

### Port 3000 Already in Use

```bash
# Windows
netstat -ano | findstr :3000
# Find the PID and kill the process
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- -p 3001
```

## Security Notes

- **Never commit** `.env.local` to version control
- **Never share** your service role key
- Use environment variables for all sensitive data
- RLS policies restrict database access to authenticated users only
- Admin routes are protected by session checks

## Support

For issues with:
- **Supabase**: https://supabase.com/docs
- **Resend**: https://resend.com/docs
- **Vercel**: https://vercel.com/docs
- **Next.js**: https://nextjs.org/docs
