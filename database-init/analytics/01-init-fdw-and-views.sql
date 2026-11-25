-- Database: analytics_db
-- Data Warehouse & Datamart domain
-- Consumes Foreign Data from:
--   1. postgres-core (users, orders, order_items, products, payments)
--   2. postgres-logistics (shipments, warehouses, inventory_logs)

CREATE SCHEMA IF NOT EXISTS datamart;

-- 1. Enable postgres_fdw
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- 2. Foreign Server 1: postgres-core
CREATE SERVER IF NOT EXISTS core_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'postgres-core', dbname 'core_db', port '5432');

CREATE USER MAPPING IF NOT EXISTS FOR postgres
    SERVER core_server
    OPTIONS (user 'postgres', password 'postgres123');

-- 3. Foreign Server 2: postgres-logistics
CREATE SERVER IF NOT EXISTS logistics_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'postgres-logistics', dbname 'logistics_db', port '5432');

CREATE USER MAPPING IF NOT EXISTS FOR postgres
    SERVER logistics_server
    OPTIONS (user 'postgres', password 'postgres123');

-- 4. Foreign Tables from core_db
CREATE FOREIGN TABLE IF NOT EXISTS public.f_users (
    id INT,
    username VARCHAR(50),
    full_name VARCHAR(100),
    email VARCHAR(150),
    country VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE
)
SERVER core_server
OPTIONS (schema_name 'public', table_name 'users');

CREATE FOREIGN TABLE IF NOT EXISTS public.f_orders (
    id INT,
    user_id INT,
    order_number VARCHAR(50),
    order_date TIMESTAMP WITH TIME ZONE,
    total_amount NUMERIC(15, 2),
    status VARCHAR(30)
)
SERVER core_server
OPTIONS (schema_name 'sales', table_name 'orders');

CREATE FOREIGN TABLE IF NOT EXISTS public.f_order_items (
    id INT,
    order_id INT,
    product_id INT,
    quantity INT,
    unit_price NUMERIC(15, 2)
)
SERVER core_server
OPTIONS (schema_name 'sales', table_name 'order_items');

CREATE FOREIGN TABLE IF NOT EXISTS public.f_products (
    id INT,
    sku VARCHAR(50),
    name VARCHAR(150),
    category VARCHAR(50),
    price NUMERIC(15, 2),
    stock_quantity INT
)
SERVER core_server
OPTIONS (schema_name 'sales', table_name 'products');

CREATE FOREIGN TABLE IF NOT EXISTS public.f_payments (
    id INT,
    order_id INT,
    payment_method VARCHAR(50),
    transaction_ref VARCHAR(100),
    amount NUMERIC(15, 2),
    status VARCHAR(30),
    paid_at TIMESTAMP WITH TIME ZONE
)
SERVER core_server
OPTIONS (schema_name 'sales', table_name 'payments');

-- 5. Foreign Tables from logistics_db
CREATE FOREIGN TABLE IF NOT EXISTS public.f_shipments (
    id INT,
    order_id INT,
    tracking_number VARCHAR(50),
    warehouse_id INT,
    carrier VARCHAR(50),
    shipping_cost NUMERIC(12, 2),
    status VARCHAR(30),
    estimated_delivery DATE,
    shipped_at TIMESTAMP WITH TIME ZONE
)
SERVER logistics_server
OPTIONS (schema_name 'public', table_name 'shipments');

CREATE FOREIGN TABLE IF NOT EXISTS public.f_warehouses (
    id INT,
    code VARCHAR(20),
    name VARCHAR(100),
    city VARCHAR(50),
    capacity_sqm INT
)
SERVER logistics_server
OPTIONS (schema_name 'public', table_name 'warehouses');

CREATE FOREIGN TABLE IF NOT EXISTS public.f_inventory_logs (
    id INT,
    product_id INT,
    warehouse_id INT,
    change_qty INT,
    reason VARCHAR(100),
    logged_at TIMESTAMP WITH TIME ZONE
)
SERVER logistics_server
OPTIONS (schema_name 'public', table_name 'inventory_logs');

-- 6. Datamart Native & Materialized Views (Cross-DB Lineage)
CREATE OR REPLACE VIEW datamart.v_cross_db_sales_fulfillment AS
SELECT 
    o.order_number,
    u.full_name AS customer_name,
    u.country,
    o.total_amount,
    p.payment_method,
    p.status AS payment_status,
    s.tracking_number,
    s.carrier,
    w.city AS fulfillment_hub,
    s.status AS shipment_status
FROM public.f_orders o
JOIN public.f_users u ON o.user_id = u.id
LEFT JOIN public.f_payments p ON o.id = p.order_id
LEFT JOIN public.f_shipments s ON o.id = s.order_id
LEFT JOIN public.f_warehouses w ON s.warehouse_id = w.id;

CREATE OR REPLACE VIEW datamart.v_revenue_by_carrier AS
SELECT 
    COALESCE(s.carrier, 'UNASSIGNED') AS carrier,
    COUNT(DISTINCT o.id) AS total_orders,
    SUM(o.total_amount) AS gross_merchandise_val,
    SUM(COALESCE(s.shipping_cost, 0)) AS total_shipping_cost
FROM public.f_orders o
LEFT JOIN public.f_shipments s ON o.id = s.order_id
GROUP BY s.carrier;
