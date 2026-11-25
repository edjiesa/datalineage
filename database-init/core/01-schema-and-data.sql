-- Database: core_db
-- OLTP Master: Users, Sales, Products, Payments

CREATE SCHEMA IF NOT EXISTS sales;

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    country VARCHAR(50) DEFAULT 'Indonesia',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id INT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20),
    delivery_address TEXT,
    loyalty_tier VARCHAR(20) DEFAULT 'Bronze',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products catalog
CREATE TABLE IF NOT EXISTS sales.products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS sales.orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES public.users(id),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING'
);

-- Order Items
CREATE TABLE IF NOT EXISTS sales.order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES sales.products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS sales.payments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES sales.orders(id),
    payment_method VARCHAR(50) NOT NULL,
    transaction_ref VARCHAR(100) UNIQUE,
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'SUCCESS',
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial data
INSERT INTO public.users (username, full_name, email, country) VALUES
('budi_santoso', 'Budi Santoso', 'budi@example.com', 'Indonesia'),
('siti_nurhaliza', 'Siti Nurhaliza', 'siti@example.com', 'Indonesia'),
('john_doe', 'John Doe', 'john@example.com', 'Singapore'),
('jane_smith', 'Jane Smith', 'jane@example.com', 'Malaysia')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_profiles (user_id, phone_number, delivery_address, loyalty_tier) VALUES
(1, '+6281234567890', 'Jl. Sudirman No. 12, Jakarta Selatan', 'Gold'),
(2, '+6281987654321', 'Jl. Dago No. 45, Bandung', 'Platinum'),
(3, '+6591234567', 'Orchard Road 10, Singapore', 'Silver'),
(4, '+60123456789', 'Bukit Bintang 88, Kuala Lumpur', 'Bronze')
ON CONFLICT DO NOTHING;

INSERT INTO sales.products (sku, name, category, price, stock_quantity) VALUES
('ELEC-001', 'Laptop UltraPro 14"', 'Electronics', 15000000.00, 25),
('ELEC-002', 'Wireless Noise Cancelling Headphones', 'Electronics', 2500000.00, 50),
('ACC-001', 'Mechanical Keyboard RGB', 'Accessories', 1200000.00, 80),
('ACC-002', 'Ergonomic Vertical Mouse', 'Accessories', 650000.00, 120)
ON CONFLICT DO NOTHING;

INSERT INTO sales.orders (user_id, order_number, total_amount, status) VALUES
(1, 'ORD-202611-0001', 17500000.00, 'COMPLETED'),
(2, 'ORD-202611-0002', 2500000.00, 'PROCESSING'),
(3, 'ORD-202611-0003', 1850000.00, 'DELIVERED'),
(4, 'ORD-202611-0004', 15000000.00, 'CONFIRMED')
ON CONFLICT DO NOTHING;

INSERT INTO sales.order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 15000000.00),
(1, 2, 1, 2500000.00),
(2, 2, 1, 2500000.00),
(3, 3, 1, 1200000.00),
(3, 4, 1, 650000.00),
(4, 1, 1, 15000000.00)
ON CONFLICT DO NOTHING;

INSERT INTO sales.payments (order_id, payment_method, transaction_ref, amount, status) VALUES
(1, 'BCA_VA', 'TXN-998811', 17500000.00, 'SUCCESS'),
(2, 'CREDIT_CARD', 'TXN-998812', 2500000.00, 'SUCCESS'),
(3, 'E_WALLET', 'TXN-998813', 1850000.00, 'SUCCESS'),
(4, 'MANDIRI_VA', 'TXN-998814', 15000000.00, 'SUCCESS')
ON CONFLICT DO NOTHING;
