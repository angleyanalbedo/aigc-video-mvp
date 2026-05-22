-- server/db/schema.sql

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  product_info TEXT,
  script TEXT,
  settings TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT,
  tags TEXT,
  embedding TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  type TEXT,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  result TEXT,
  error TEXT,
  trace TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT,
  description TEXT,
  type TEXT,
  status TEXT DEFAULT 'pending',
  check_results TEXT,
  history TEXT,
  creator TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ab_experiments (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  variants TEXT,
  results TEXT,
  sample_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
