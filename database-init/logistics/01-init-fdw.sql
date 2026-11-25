-- Database: logistics_db
-- Logistics domain: Warehouses, Shipments, Inventory Logs
-- Consumes Foreign Data from: postgres-core (core_db) via postgres_fdw

-- 1. Enable postgres_fdw extension
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- 2. Setup Foreign Server pointing to postgres-core
CREATE SERVER IF NOT EXISTS core_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'postgres-core', dbname 'core_db', port '5432');

-- 3. Create User Mapping
CREATE USER MAPPING IF NOT EXISTS FOR postgres
    SERVER core_server
    OPTIONS (user 'postgres', password 'postgres123');

-- 4. Foreign Tables from core_db
CREATE FOREIGN TABLE IF NOT EXISTS foreign_core_users (
    id INT,
    username VARCHAR(50),
    full_name VARCHAR(100),
    email VARCHAR(150),
    country VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE
)
SERVER core_server
OPTIONS (schema_name 'public', table_name 'users');

CREATE FOREIGN TABLE IF NOT EXISTS foreign_core_orders (
    id INT,
    user_id INT,
    order_number VARCHAR(50),
    order_date TIMESTAMP WITH TIME ZONE,
    total_amount NUMERIC(15, 2),
    status VARCHAR(30)
)
SERVER core_server
OPTIONS (schema_name 'sales', table_name 'orders');

CREATE FOREIGN TABLE IF NOT EXISTS foreign_core_products (
    id INT,
    sku VARCHAR(50),
    name VARCHAR(150),
    category VARCHAR(50),
    price NUMERIC(15, 2),
    stock_quantity INT
)
SERVER core_server
OPTIONS (schema_name 'sales', table_name 'products');

-- 5. Native Logistics Tables
CREATE TABLE IF NOT EXISTS public.warehouses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    capacity_sqm INT DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS public.shipments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL, -- references foreign_core_orders.id logically
    tracking_number VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id INT NOT NULL REFERENCES public.warehouses(id),
    carrier VARCHAR(50) NOT NULL,
    shipping_cost NUMERIC(12, 2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'IN_TRANSIT',
    estimated_delivery DATE,
    shipped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL, -- references foreign_core_products.id logically
    warehouse_id INT NOT NULL REFERENCES public.warehouses(id),
    change_qty INT NOT NULL,
    reason VARCHAR(100),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Cross-Database Analytical View
CREATE OR REPLACE VIEW public.v_order_shipment_status AS
SELECT 
    o.order_number,
    u.full_name AS customer_name,
    u.email AS customer_email,
    s.tracking_number,
    s.carrier,
    s.status AS shipment_status,
    w.name AS dispatch_warehouse,
    o.total_amount,
    s.shipped_at
FROM shipments s
JOIN warehouses w ON s.warehouse_id = w.id
JOIN foreign_core_orders o ON s.order_id = o.id
JOIN foreign_core_users u ON o.user_id = u.id;

-- 7. Seed Initial Data
INSERT INTO public.warehouses (code, name, city, capacity_sqm) VALUES
('WH-CGK-01', 'Cengkareng Central Hub', 'Tangerang', 5000),
('WH-SUB-01', 'Rungkut Distribution Center', 'Surabaya', 3500),
('WH-BDG-01', 'Gedebage Logistics Depot', 'Bandung', 2000)
ON CONFLICT DO NOTHING;

INSERT INTO public.shipments (order_id, tracking_number, warehouse_id, carrier, shipping_cost, status, estimated_delivery) VALUES
(1, 'JNE-202611-00192', 1, 'JNE Express', 45000.00, 'DELIVERED', CURRENT_DATE),
(2, 'SICEPAT-202611-00812', 1, 'SiCepat Halu', 22000.00, 'IN_TRANSIT', CURRENT_DATE + 2),
(3, 'ANTERAJA-202611-00331', 2, 'Anteraja Regular', 18000.00, 'DELIVERED', CURRENT_DATE - 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_logs (product_id, warehouse_id, change_qty, reason) VALUES
(1, 1, -1, 'Order fulfillment ORD-202611-0001'),
(2, 1, -1, 'Order fulfillment ORD-202611-0001'),
(2, 2, -1, 'Order fulfillment ORD-202611-0002')
ON CONFLICT DO NOTHING;
