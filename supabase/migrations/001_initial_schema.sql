-- Clients (people who inquire or book)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  partner_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services (for future package management)
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2),
  duration_hours DECIMAL(4,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packages (for future package management)
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_hours DECIMAL(4,2),
  retainer_percentage DECIMAL(5,2) DEFAULT 50,
  retainer_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Package Services (many-to-many)
CREATE TABLE package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads (inquiries - Phase 1 statuses only)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'New Inquiry',
  CHECK (status IN ('New Inquiry', 'Needs Information', 'Quote Sent', 'Awaiting Response', 'Contract Sent', 'Awaiting Retainer', 'Lost')),
  event_date DATE,
  venue_name VARCHAR(255),
  venue_address TEXT,
  service_type VARCHAR(100),
  package_interest VARCHAR(100),
  performance_start_time TIME,
  performance_end_time TIME,
  estimated_duration_hours DECIMAL(4,2),
  guest_count INTEGER,
  budget_range VARCHAR(100),
  how_they_found_us VARCHAR(100),
  message TEXT,
  quoted_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  next_follow_up_date DATE
);

-- Bookings (confirmed events - separate statuses)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'Tentative',
  CHECK (status IN ('Tentative', 'Confirmed', 'Cancelled', 'Completed')),
  event_date DATE NOT NULL,
  venue_name VARCHAR(255),
  venue_address TEXT,
  service_type VARCHAR(100) NOT NULL,
  package_id UUID REFERENCES packages(id),
  performance_start_time TIME,
  performance_end_time TIME,
  setup_time TIME,
  breakdown_time TIME,
  travel_buffer_hours DECIMAL(4,2) DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  retainer_amount DECIMAL(10,2),
  retainer_due_date DATE,
  balance_due_date DATE,
  special_requests TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Status (separate from booking status)
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'Not Sent',
  CHECK (status IN ('Not Sent', 'Sent', 'Viewed', 'Signed', 'Cancelled')),
  contract_url TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (separate tracking)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  CHECK (payment_type IN ('Retainer', 'Balance', 'Full Payment', 'Refund')),
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  CHECK (status IN ('Pending', 'Processing', 'Completed', 'Failed', 'Refunded')),
  stripe_payment_intent_id VARCHAR(255),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes (communication history, internal notes)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  note_type VARCHAR(50) NOT NULL,
  CHECK (note_type IN ('Internal', 'Email', 'Phone', 'InPerson', 'System')),
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Communication Log (automated emails sent)
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  communication_type VARCHAR(50) NOT NULL,
  CHECK (communication_type IN ('Inquiry Acknowledgment', 'Quote', 'Contract', 'Payment Receipt', 'Reminder')),
  subject VARCHAR(500),
  content TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status VARCHAR(50) DEFAULT 'Sent',
  CHECK (delivery_status IN ('Sent', 'Delivered', 'Failed')),
  resend_id VARCHAR(255)
);

-- Availability Blocks (for future calendar)
CREATE TABLE availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  block_type VARCHAR(50) NOT NULL,
  CHECK (block_type IN ('Unavailable', 'Tentative Hold', 'Personal')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follow-up Tasks (for future automation)
CREATE TABLE follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL,
  CHECK (task_type IN ('Follow Up', 'Send Quote', 'Send Contract', 'Payment Reminder')),
  due_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_event_date ON leads(event_date);
CREATE INDEX idx_bookings_lead_id ON bookings(lead_id);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_event_date ON bookings(event_date);
CREATE INDEX idx_contracts_booking_id ON contracts(booking_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_notes_lead_id ON notes(lead_id);
CREATE INDEX idx_notes_booking_id ON notes(booking_id);
CREATE INDEX idx_communications_lead_id ON communications(lead_id);
CREATE INDEX idx_availability_blocks_dates ON availability_blocks(start_date, end_date);
CREATE INDEX idx_follow_up_tasks_lead_id ON follow_up_tasks(lead_id);
