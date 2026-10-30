-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;

-- Policies: Only authenticated users can access all tables
CREATE POLICY "Authenticated users can view clients" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert clients" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update clients" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete clients" ON clients
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view leads" ON leads
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert leads" ON leads
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update leads" ON leads
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete leads" ON leads
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view bookings" ON bookings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert bookings" ON bookings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update bookings" ON bookings
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete bookings" ON bookings
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view contracts" ON contracts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert contracts" ON contracts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update contracts" ON contracts
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete contracts" ON contracts
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view payments" ON payments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert payments" ON payments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update payments" ON payments
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete payments" ON payments
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view services" ON services
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert services" ON services
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update services" ON services
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete services" ON services
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view packages" ON packages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert packages" ON packages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update packages" ON packages
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete packages" ON packages
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view package_services" ON package_services
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert package_services" ON package_services
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete package_services" ON package_services
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view notes" ON notes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert notes" ON notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update notes" ON notes
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete notes" ON notes
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view communications" ON communications
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert communications" ON communications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update communications" ON communications
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete communications" ON communications
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view availability_blocks" ON availability_blocks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert availability_blocks" ON availability_blocks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update availability_blocks" ON availability_blocks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete availability_blocks" ON availability_blocks
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view follow_up_tasks" ON follow_up_tasks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert follow_up_tasks" ON follow_up_tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update follow_up_tasks" ON follow_up_tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete follow_up_tasks" ON follow_up_tasks
  FOR DELETE USING (auth.role() = 'authenticated');
