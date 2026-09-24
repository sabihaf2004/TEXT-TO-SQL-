import { newDb, IMemoryDb } from 'pg-mem';

let dbInstance: IMemoryDb | null = null;

export interface TableColumn {
  name: string;
  type: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: string;
  description?: string;
}

export interface TableSchema {
  tableName: string;
  description: string;
  columns: TableColumn[];
  rowCount: number;
}

export function getDatabase(): IMemoryDb {
  if (dbInstance) {
    return dbInstance;
  }

  const db = newDb();

  // Create relational schema for E-Commerce / SaaS Store
  db.public.none(`
    CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      department VARCHAR(100) NOT NULL
    );

    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      sku VARCHAR(50) UNIQUE NOT NULL,
      category_id INT REFERENCES categories(id),
      price NUMERIC(10, 2) NOT NULL,
      cost NUMERIC(10, 2) NOT NULL,
      stock_quantity INT NOT NULL,
      reorder_level INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      country VARCHAR(80) NOT NULL,
      city VARCHAR(100) NOT NULL,
      segment VARCHAR(50) NOT NULL, -- 'Enterprise', 'Mid-Market', 'SMB', 'Consumer'
      account_balance NUMERIC(10, 2) DEFAULT 0.00,
      status VARCHAR(30) DEFAULT 'active', -- 'active', 'dormant', 'churned'
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES customers(id),
      order_date TIMESTAMP NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL, -- 'completed', 'pending', 'shipped', 'cancelled', 'refunded'
      payment_method VARCHAR(50) NOT NULL, -- 'credit_card', 'wire_transfer', 'paypal', 'stripe'
      shipping_city VARCHAR(100) NOT NULL,
      discount_applied NUMERIC(10, 2) DEFAULT 0.00
    );

    CREATE TABLE order_items (
      id SERIAL PRIMARY KEY,
      order_id INT REFERENCES orders(id),
      product_id INT REFERENCES products(id),
      quantity INT NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL,
      discount NUMERIC(10, 2) DEFAULT 0.00
    );

    CREATE TABLE support_tickets (
      id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES customers(id),
      subject VARCHAR(200) NOT NULL,
      priority VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'urgent'
      status VARCHAR(30) NOT NULL, -- 'open', 'in_progress', 'resolved', 'closed'
      created_at TIMESTAMP NOT NULL,
      resolved_at TIMESTAMP
    );
  `);

  // Seed Categories
  db.public.none(`
    INSERT INTO categories (name, department) VALUES
      ('Cloud Hosting & Compute', 'Infrastructure'),
      ('Database & Storage', 'Infrastructure'),
      ('AI & ML Workstations', 'Hardware'),
      ('Developer Tools & IDEs', 'Software'),
      ('Enterprise Security Suites', 'Security'),
      ('Networking & Edge CDN', 'Infrastructure');
  `);

  // Seed Products
  db.public.none(`
    INSERT INTO products (name, sku, category_id, price, cost, stock_quantity, reorder_level, is_active) VALUES
      ('Aurora HyperCompute Instance', 'COMP-001', 1, 1200.00, 480.00, 45, 10, true),
      ('Nebula Dedicated Cloud Core', 'COMP-002', 1, 2400.00, 950.00, 20, 5, true),
      ('OmniStore Distributed Postgres Node', 'DB-101', 2, 850.00, 320.00, 75, 15, true),
      ('VectorStream Vector Search Cluster', 'DB-102', 2, 1450.00, 600.00, 18, 10, true),
      ('TensorPro AI Accelerator Rig', 'HW-201', 3, 4999.00, 3200.00, 8, 5, true),
      ('Workstation Titan Extreme X', 'HW-202', 3, 3800.00, 2400.00, 12, 4, true),
      ('CodePulse Enterprise IDE License', 'DEV-301', 4, 320.00, 40.00, 450, 50, true),
      ('GitShield CI/CD Security Auditor', 'DEV-302', 4, 650.00, 90.00, 200, 30, true),
      ('ZeroTrust Perimeter Shield', 'SEC-401', 5, 1850.00, 450.00, 90, 20, true),
      ('CryptoVault HSM Key Manager', 'SEC-402', 5, 2900.00, 1100.00, 14, 5, true),
      ('EdgeCast Global CDN Accelerator', 'NET-501', 6, 450.00, 120.00, 120, 25, true),
      ('QuantumLatency SD-WAN Router', 'NET-502', 6, 1290.00, 580.00, 25, 8, true);
  `);

  // Seed Customers
  db.public.none(`
    INSERT INTO customers (name, email, country, city, segment, account_balance, status, created_at) VALUES
      ('Acro Corp Global', 'ops@acrocorp.com', 'United States', 'San Francisco', 'Enterprise', 14500.00, 'active', '2023-01-15 09:30:00'),
      ('Stellar Labs Innovations', 'billing@stellarlabs.io', 'United Kingdom', 'London', 'Enterprise', 9800.00, 'active', '2023-02-20 11:15:00'),
      ('Apex FinTech Systems', 'tech@apexfin.de', 'Germany', 'Frankfurt', 'Enterprise', 18200.00, 'active', '2023-03-05 14:00:00'),
      ('BlueWave Digital Media', 'finance@bluewavedigital.com', 'United States', 'New York', 'Mid-Market', 4200.00, 'active', '2023-04-10 16:45:00'),
      ('Nordic Dataworks Oy', 'contact@nordicdataworks.fi', 'Finland', 'Helsinki', 'Mid-Market', 5100.00, 'active', '2023-05-18 08:20:00'),
      ('Quantum Health AI', 'purchasing@quantumhealth.co', 'Canada', 'Toronto', 'Enterprise', 12300.00, 'active', '2023-06-22 13:10:00'),
      ('Pacific Wave Creative', 'info@pacificwave.jp', 'Japan', 'Tokyo', 'SMB', 1200.00, 'active', '2023-07-09 10:00:00'),
      ('Kestrel Logistics SaaS', 'it@kestrellogistics.com', 'United States', 'Chicago', 'Mid-Market', 3800.00, 'active', '2023-08-14 15:30:00'),
      ('Veloce Motors Telemetry', 'engineering@velocemotors.it', 'Italy', 'Milan', 'Mid-Market', 2900.00, 'dormant', '2023-09-01 12:00:00'),
      ('Solaria Clean Energy', 'admin@solariagroup.es', 'Spain', 'Madrid', 'SMB', 850.00, 'active', '2023-10-11 17:15:00'),
      ('Silverline Analytics', 'dev@silverline.au', 'Australia', 'Sydney', 'SMB', 600.00, 'churned', '2023-11-04 09:45:00'),
      ('Atlas Genomics Research', 'lab@atlasgenomics.ch', 'Switzerland', 'Zurich', 'Enterprise', 16400.00, 'active', '2023-12-01 14:20:00'),
      ('Zephyr Studio Games', 'billing@zephyrstudios.se', 'Sweden', 'Stockholm', 'SMB', 450.00, 'active', '2024-01-10 11:00:00'),
      ('Beacon Retail AI', 'cloud@beaconretail.com', 'United States', 'Seattle', 'Mid-Market', 3100.00, 'active', '2024-02-14 16:00:00'),
      ('Hyperion Security Labs', 'security@hyperionsec.fr', 'France', 'Paris', 'Enterprise', 11900.00, 'active', '2024-03-02 10:30:00');
  `);

  // Seed Orders
  db.public.none(`
    INSERT INTO orders (customer_id, order_date, total_amount, status, payment_method, shipping_city, discount_applied) VALUES
      (1, '2024-01-12 10:15:00', 7399.00, 'completed', 'wire_transfer', 'San Francisco', 200.00),
      (1, '2024-02-18 14:20:00', 4850.00, 'completed', 'wire_transfer', 'San Francisco', 150.00),
      (1, '2024-03-22 09:40:00', 6850.00, 'completed', 'wire_transfer', 'San Francisco', 300.00),
      (2, '2024-01-20 11:30:00', 5800.00, 'completed', 'credit_card', 'London', 100.00),
      (2, '2024-03-05 16:10:00', 6090.00, 'completed', 'credit_card', 'London', 250.00),
      (3, '2024-01-08 08:50:00', 9800.00, 'completed', 'wire_transfer', 'Frankfurt', 400.00),
      (3, '2024-02-25 13:45:00', 8400.00, 'completed', 'wire_transfer', 'Frankfurt', 350.00),
      (4, '2024-01-14 15:00:00', 2550.00, 'completed', 'stripe', 'New York', 50.00),
      (4, '2024-03-11 12:25:00', 1650.00, 'completed', 'stripe', 'New York', 0.00),
      (5, '2024-02-01 10:00:00', 3150.00, 'completed', 'credit_card', 'Helsinki', 100.00),
      (6, '2024-01-29 14:15:00', 7400.00, 'completed', 'wire_transfer', 'Toronto', 250.00),
      (6, '2024-03-18 17:30:00', 4900.00, 'completed', 'wire_transfer', 'Toronto', 180.00),
      (7, '2024-02-10 09:20:00', 970.00, 'completed', 'paypal', 'Tokyo', 20.00),
      (8, '2024-01-25 11:40:00', 2140.00, 'completed', 'credit_card', 'Chicago', 60.00),
      (8, '2024-03-02 14:50:00', 1660.00, 'completed', 'credit_card', 'Chicago', 40.00),
      (9, '2023-11-15 13:00:00', 2900.00, 'completed', 'wire_transfer', 'Milan', 100.00),
      (10, '2024-02-28 16:30:00', 850.00, 'completed', 'stripe', 'Madrid', 0.00),
      (12, '2024-01-18 10:45:00', 8799.00, 'completed', 'wire_transfer', 'Zurich', 300.00),
      (12, '2024-03-15 15:10:00', 7600.00, 'completed', 'wire_transfer', 'Zurich', 250.00),
      (13, '2024-02-05 12:15:00', 450.00, 'completed', 'paypal', 'Stockholm', 0.00),
      (14, '2024-02-22 14:00:00', 3100.00, 'completed', 'credit_card', 'Seattle', 100.00),
      (15, '2024-03-10 11:20:00', 6650.00, 'completed', 'wire_transfer', 'Paris', 200.00),
      (1, '2024-03-28 16:00:00', 1200.00, 'pending', 'wire_transfer', 'San Francisco', 0.00),
      (3, '2024-03-29 10:30:00', 2900.00, 'shipped', 'wire_transfer', 'Frankfurt', 100.00),
      (4, '2024-03-29 11:45:00', 650.00, 'cancelled', 'stripe', 'New York', 0.00);
  `);

  // Seed Order Items
  db.public.none(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount) VALUES
      (1, 5, 1, 4999.00, 100.00),
      (1, 2, 1, 2400.00, 100.00),
      (2, 1, 2, 1200.00, 50.00),
      (2, 2, 1, 2400.00, 100.00),
      (3, 10, 2, 2900.00, 200.00),
      (3, 4, 1, 1450.00, 100.00),
      (4, 9, 2, 1850.00, 100.00),
      (4, 7, 6, 320.00, 0.00),
      (5, 5, 1, 4999.00, 150.00),
      (5, 11, 2, 450.00, 100.00),
      (6, 5, 1, 4999.00, 200.00),
      (6, 10, 1, 2900.00, 100.00),
      (6, 1, 1, 1200.00, 100.00),
      (7, 2, 2, 2400.00, 200.00),
      (7, 9, 2, 1850.00, 150.00),
      (8, 3, 3, 850.00, 50.00),
      (9, 7, 5, 320.00, 0.00),
      (10, 1, 2, 1200.00, 50.00),
      (10, 11, 1, 450.00, 50.00),
      (11, 5, 1, 4999.00, 150.00),
      (11, 2, 1, 2400.00, 100.00),
      (12, 9, 2, 1850.00, 100.00),
      (12, 1, 1, 1200.00, 80.00),
      (13, 7, 3, 320.00, 20.00),
      (14, 8, 2, 650.00, 60.00),
      (15, 7, 5, 320.00, 40.00),
      (16, 10, 1, 2900.00, 100.00),
      (17, 3, 1, 850.00, 0.00),
      (18, 5, 1, 4999.00, 200.00),
      (18, 6, 1, 3800.00, 100.00),
      (19, 10, 2, 2900.00, 150.00),
      (19, 9, 1, 1850.00, 100.00),
      (20, 11, 1, 450.00, 0.00),
      (21, 8, 4, 650.00, 100.00),
      (22, 9, 3, 1850.00, 150.00),
      (22, 11, 2, 450.00, 50.00);
  `);

  // Seed Support Tickets
  db.public.none(`
    INSERT INTO support_tickets (customer_id, subject, priority, status, created_at, resolved_at) VALUES
      (1, 'Need dedicated VPC peering configuration for SF office', 'medium', 'resolved', '2024-02-10 10:00:00', '2024-02-11 14:00:00'),
      (3, 'Latency spike on Frankfurt cloud core node', 'urgent', 'resolved', '2024-02-28 08:30:00', '2024-02-28 11:15:00'),
      (6, 'Request for custom GPU driver stack installation', 'high', 'resolved', '2024-03-01 16:00:00', '2024-03-03 09:30:00'),
      (9, 'Subscription pause inquiry due to internal restructuring', 'low', 'open', '2024-03-12 11:00:00', NULL),
      (11, 'Cancellation and export of historical compliance telemetry', 'medium', 'closed', '2024-01-15 15:45:00', '2024-01-16 10:20:00'),
      (2, 'Invoice breakdown request for March compute cycles', 'low', 'in_progress', '2024-03-24 13:10:00', NULL);
  `);

  dbInstance = db;
  return dbInstance;
}

export function getSchemaMetadata(): TableSchema[] {
  const db = getDatabase();

  const schemas: TableSchema[] = [
    {
      tableName: 'customers',
      description: 'Customer profiles, geographic details, segments, account balances, and status.',
      rowCount: db.public.one(`SELECT COUNT(*) as count FROM customers`).count,
      columns: [
        { name: 'id', type: 'SERIAL (INT)', isPrimary: true, description: 'Unique customer identifier' },
        { name: 'name', type: 'VARCHAR(120)', description: 'Customer or company name' },
        { name: 'email', type: 'VARCHAR(150)', description: 'Contact email' },
        { name: 'country', type: 'VARCHAR(80)', description: 'Operating country' },
        { name: 'city', type: 'VARCHAR(100)', description: 'Headquarters city' },
        { name: 'segment', type: 'VARCHAR(50)', description: "Customer tier ('Enterprise', 'Mid-Market', 'SMB', 'Consumer')" },
        { name: 'account_balance', type: 'NUMERIC(10,2)', description: 'Current available credit or balance in USD' },
        { name: 'status', type: 'VARCHAR(30)', description: "Account status ('active', 'dormant', 'churned')" },
        { name: 'created_at', type: 'TIMESTAMP', description: 'Customer sign-up timestamp' }
      ]
    },
    {
      tableName: 'orders',
      description: 'Customer order transactions, dates, total amounts, and payment methods.',
      rowCount: db.public.one(`SELECT COUNT(*) as count FROM orders`).count,
      columns: [
        { name: 'id', type: 'SERIAL (INT)', isPrimary: true, description: 'Unique order ID' },
        { name: 'customer_id', type: 'INT', isForeign: true, references: 'customers(id)', description: 'Associated customer' },
        { name: 'order_date', type: 'TIMESTAMP', description: 'Timestamp when order was placed' },
        { name: 'total_amount', type: 'NUMERIC(10,2)', description: 'Total transaction value in USD' },
        { name: 'status', type: 'VARCHAR(50)', description: "Order status ('completed', 'pending', 'shipped', 'cancelled')" },
        { name: 'payment_method', type: 'VARCHAR(50)', description: "Payment mode ('wire_transfer', 'credit_card', 'stripe', 'paypal')" },
        { name: 'shipping_city', type: 'VARCHAR(100)', description: 'Destination city' },
        { name: 'discount_applied', type: 'NUMERIC(10,2)', description: 'Discount applied in USD' }
      ]
    },
    {
      tableName: 'order_items',
      description: 'Line items within an order, quantities, unit prices, and discounts.',
      rowCount: db.public.one(`SELECT COUNT(*) as count FROM order_items`).count,
      columns: [
        { name: 'id', type: 'SERIAL (INT)', isPrimary: true, description: 'Line item ID' },
        { name: 'order_id', type: 'INT', isForeign: true, references: 'orders(id)', description: 'Parent order' },
        { name: 'product_id', type: 'INT', isForeign: true, references: 'products(id)', description: 'Purchased product' },
        { name: 'quantity', type: 'INT', description: 'Units purchased' },
        { name: 'unit_price', type: 'NUMERIC(10,2)', description: 'Price per unit at sale time' },
        { name: 'discount', type: 'NUMERIC(10,2)', description: 'Item level discount' }
      ]
    },
    {
      tableName: 'products',
      description: 'Catalog products, pricing, unit cost, inventory stock levels, and active status.',
      rowCount: db.public.one(`SELECT COUNT(*) as count FROM products`).count,
      columns: [
        { name: 'id', type: 'SERIAL (INT)', isPrimary: true, description: 'Product ID' },
        { name: 'name', type: 'VARCHAR(150)', description: 'Product title' },
        { name: 'sku', type: 'VARCHAR(50)', description: 'Unique SKU stock keeping unit' },
        { name: 'category_id', type: 'INT', isForeign: true, references: 'categories(id)', description: 'Associated category' },
        { name: 'price', type: 'NUMERIC(10,2)', description: 'Retail price in USD' },
        { name: 'cost', type: 'NUMERIC(10,2)', description: 'Wholesale cost in USD' },
        { name: 'stock_quantity', type: 'INT', description: 'Current available units in stock' },
        { name: 'reorder_level', type: 'INT', description: 'Inventory threshold for reordering' },
        { name: 'is_active', type: 'BOOLEAN', description: 'Whether product is active for purchase' }
      ]
    },
    {
      tableName: 'categories',
      description: 'Product category taxonomy and high-level departments.',
      rowCount: db.public.one(`SELECT COUNT(*) as count FROM categories`).count,
      columns: [
        { name: 'id', type: 'SERIAL (INT)', isPrimary: true, description: 'Category ID' },
        { name: 'name', type: 'VARCHAR(100)', description: 'Category name' },
        { name: 'department', type: 'VARCHAR(100)', description: 'High-level department' }
      ]
    },
    {
      tableName: 'support_tickets',
      description: 'Customer service inquiries, priority levels, and resolution timestamps.',
      rowCount: db.public.one(`SELECT COUNT(*) as count FROM support_tickets`).count,
      columns: [
        { name: 'id', type: 'SERIAL (INT)', isPrimary: true, description: 'Ticket ID' },
        { name: 'customer_id', type: 'INT', isForeign: true, references: 'customers(id)', description: 'Customer submitting ticket' },
        { name: 'subject', type: 'VARCHAR(200)', description: 'Inquiry subject' },
        { name: 'priority', type: 'VARCHAR(20)', description: "Ticket priority ('low', 'medium', 'high', 'urgent')" },
        { name: 'status', type: 'VARCHAR(30)', description: "Ticket status ('open', 'in_progress', 'resolved', 'closed')" },
        { name: 'created_at', type: 'TIMESTAMP', description: 'Submission timestamp' },
        { name: 'resolved_at', type: 'TIMESTAMP', description: 'Resolution timestamp (null if unresolved)' }
      ]
    }
  ];

  return schemas;
}

export function executeQuery(sql: string): { rows: any[]; executionTimeMs: number; rowCount: number } {
  const db = getDatabase();
  const startTime = performance.now();
  const rows = db.public.many(sql);
  const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(2));
  return {
    rows,
    executionTimeMs,
    rowCount: rows.length
  };
}
