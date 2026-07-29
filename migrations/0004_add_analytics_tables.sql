-- Migration: Add mobile analytics tables
-- app_events: tracks session lifecycle and key user actions from the mobile app
CREATE TABLE IF NOT EXISTS app_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  screen TEXT,
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_events_user_id ON app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_event_name ON app_events(event_name);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at DESC);

-- app_errors: tracks unhandled JS errors and promise rejections from the mobile app
CREATE TABLE IF NOT EXISTS app_errors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  screen TEXT,
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_errors_user_id ON app_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_app_errors_created_at ON app_errors(created_at DESC);
