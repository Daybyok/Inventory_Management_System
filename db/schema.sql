-- ─── INVENTORY MANAGEMENT SYSTEM (Inventory App) ───────────────────────────
-- Run with: npm run db:init
-- Or import this file in phpMyAdmin (XAMPP).
--
-- NOTE: The old `users` table from earlier versions is no longer used.
-- You can remove it manually if it exists: DROP TABLE IF EXISTS users;

CREATE DATABASE IF NOT EXISTS inventory_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory_db;

-- ─── LOGINS ───────────────────────────────────────────────────────────────
-- Default accounts are created automatically by the server on first start:
--   admin / admin123  (admin)
--   staff / staff123  (staff)
CREATE TABLE IF NOT EXISTS logins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('staff', 'admin') NOT NULL DEFAULT 'staff',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── LOCATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type ENUM('warehouse', 'shelf', 'bin') DEFAULT 'warehouse',
  address VARCHAR(500) DEFAULT '',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── SUPPLIERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  contact_name VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── ITEMS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  SKU VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(100) DEFAULT 'General',
  description TEXT,
  quantity INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  location_id INT DEFAULT 1,
  status ENUM('in_stock', 'low_stock', 'out_stock') NOT NULL DEFAULT 'in_stock',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_items_category (category),
  INDEX idx_items_status (status),
  INDEX idx_items_location (location_id),
  CONSTRAINT fk_items_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- ─── MOVEMENTS (In/Out/Transfer) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  location_id INT DEFAULT 1,
  type ENUM('in', 'out', 'transfer') DEFAULT 'out',
  quantity INT NOT NULL DEFAULT 0,
  reference_number VARCHAR(255) DEFAULT '',
  reason TEXT,
  movement_date DATE NOT NULL DEFAULT (CURDATE()),
  processed TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_movements_item (item_id),
  INDEX idx_movements_type (type),
  INDEX idx_movements_date (movement_date),
  CONSTRAINT fk_movements_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- ─── SEED DATA (safe to re-run) ───────────────────────────────────────────
INSERT IGNORE INTO locations (name, type, address) VALUES
  ('Main Warehouse', 'warehouse', 'Sector A'),
  ('Shelf A1', 'shelf', 'Row 1'),
  ('Shelf A2', 'shelf', 'Row 2'),
  ('Bin B-01', 'bin', 'Station B01'),
  ('Bin B-02', 'bin', 'Station B02');

INSERT IGNORE INTO suppliers (name, email, phone, contact_name) VALUES
  ('Fresh Produce Co.', 'sales@freshproduce.com', '+63-123-456-7890', 'Maria Santos'),
  ('Global Supplies Inc.', 'orders@globalsupplies.com', '+63-987-654-3210', 'John Reynolds'),
  ('Local Distributors', 'contact@localdist.com', '+63-555-123-4567', 'Anna Carey');

INSERT IGNORE INTO items (name, SKU, category, quantity, unit_price, location_id, status) VALUES
  ('White Rice 10kg', 'WR-10KG-001', 'Grains', 150, 45.00, 1, 'in_stock'),
  ('Brown Rice 5kg', 'BR-5KG-002', 'Grains', 30, 55.00, 2, 'in_stock'),
  ('Chicken Breast', 'CH-500G-001', 'Meat', 8, 120.00, 1, 'low_stock'),
  ('Fresh Milk 1L', 'FM-1L-001', 'Dairy', 45, 45.00, 3, 'in_stock'),
  ('Banana 20ea', 'BN-20EA-001', 'Produce', 200, 15.00, 1, 'in_stock'),
  ('Apple 1kg', 'AP-1KG-001', 'Produce', 50, 60.00, 1, 'in_stock'),
  ('Laundry Detergent 500g', 'LD-500G-001', 'Household', 12, 22.00, 4, 'low_stock'),
  ('Disinfectant Solution', 'DS-1L-001', 'Household', 5, 45.00, 5, 'low_stock');

INSERT INTO movements (item_id, location_id, type, quantity, reference_number, reason, movement_date, processed)
SELECT * FROM (
  SELECT 1 AS item_id, 1 AS location_id, 'in' AS type, 100 AS quantity, 'PO-2024-001' AS reference_number, 'Initial stock shipment' AS reason, '2024-01-05' AS movement_date, 1 AS processed UNION ALL
  SELECT 3, 1, 'in', 8, 'PO-2024-003', 'Receiving shipment', '2024-01-08', 1 UNION ALL
  SELECT 7, 1, 'in', 8, 'PO-2024-005', 'From Local Distributors', '2024-01-10', 1 UNION ALL
  SELECT 8, 1, 'out', 3, 'SALES-2024-001', 'Customer order', '2024-01-12', 1 UNION ALL
  SELECT 8, 1, 'out', 1, 'EXPIRED-2024-002', 'Damaged items', '2024-01-15', 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM movements);

SELECT 'Inventory DB schema loaded successfully!' AS Message;
