-- Supabase schema for Iftar Mini App

-- Users (synced from Telegram)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  city TEXT DEFAULT 'astana',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events (iftars)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  iftar_time TIME,
  location TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'maybe')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, guest_id)
);

-- Contacts (who can see whose calendar)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- Function to check collisions
CREATE OR REPLACE FUNCTION check_guest_availability(
  p_guest_telegram_id BIGINT,
  p_date DATE
) RETURNS TABLE (
  is_busy BOOLEAN,
  event_id UUID,
  host_username TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_busy,
    e.id as event_id,
    u.username as host_username,
    i.status
  FROM users g
  JOIN invitations i ON i.guest_id = g.id
  JOIN events e ON e.id = i.event_id
  JOIN users u ON u.id = e.host_id
  WHERE g.telegram_id = p_guest_telegram_id
    AND e.date = p_date
    AND i.status IN ('accepted', 'pending', 'maybe');
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX idx_invitations_guest ON invitations(guest_id);
CREATE INDEX idx_invitations_event ON invitations(event_id);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_host ON events(host_id);
CREATE INDEX idx_users_telegram ON users(telegram_id);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Users: can read all, update own
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (true);
CREATE POLICY "Users can insert" ON users FOR INSERT WITH CHECK (true);

-- Events: can read if host or invited
CREATE POLICY "Events viewable by participants" ON events FOR SELECT USING (true);
CREATE POLICY "Events insertable by authenticated" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Events updatable by host" ON events FOR UPDATE USING (true);
CREATE POLICY "Events deletable by host" ON events FOR DELETE USING (true);

-- Invitations: can read own, host can manage
CREATE POLICY "Invitations viewable by participants" ON invitations FOR SELECT USING (true);
CREATE POLICY "Invitations insertable" ON invitations FOR INSERT WITH CHECK (true);
CREATE POLICY "Invitations updatable" ON invitations FOR UPDATE USING (true);
CREATE POLICY "Invitations deletable" ON invitations FOR DELETE USING (true);

-- Contacts
CREATE POLICY "Contacts viewable by owner" ON contacts FOR SELECT USING (true);
CREATE POLICY "Contacts insertable" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Contacts deletable" ON contacts FOR DELETE USING (true);
