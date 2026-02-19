use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial schema",
            sql: r#"
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;

                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('admin', 'pharmacist', 'cashier')),
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS gst_slabs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rate REAL NOT NULL UNIQUE,
                    description TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS medicines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    generic_name TEXT,
                    brand_name TEXT,
                    manufacturer TEXT,
                    dosage_form TEXT NOT NULL DEFAULT 'tablet',
                    strength TEXT,
                    category TEXT,
                    hsn_code TEXT NOT NULL DEFAULT '3004',
                    gst_slab_id INTEGER NOT NULL,
                    reorder_level INTEGER NOT NULL DEFAULT 20,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (gst_slab_id) REFERENCES gst_slabs(id)
                );

                CREATE TABLE IF NOT EXISTS batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicine_id INTEGER NOT NULL,
                    batch_number TEXT NOT NULL,
                    expiry_date TEXT NOT NULL,
                    cost_price_paise INTEGER NOT NULL,
                    mrp_paise INTEGER NOT NULL,
                    selling_price_paise INTEGER NOT NULL,
                    quantity INTEGER NOT NULL DEFAULT 0,
                    manufacturing_date TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
                    CHECK (selling_price_paise <= mrp_paise),
                    CHECK (cost_price_paise >= 0),
                    CHECK (mrp_paise > 0),
                    CHECK (selling_price_paise > 0),
                    CHECK (quantity >= 0)
                );

                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT,
                    email TEXT,
                    address TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS suppliers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT,
                    email TEXT,
                    address TEXT,
                    gst_in TEXT,
                    drug_license_no TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS supplier_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id INTEGER NOT NULL,
                    amount_paise INTEGER NOT NULL,
                    payment_date TEXT NOT NULL,
                    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('cash', 'card', 'upi', 'credit')),
                    reference TEXT,
                    notes TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
                );

                CREATE TABLE IF NOT EXISTS sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invoice_number TEXT NOT NULL UNIQUE,
                    customer_id INTEGER,
                    user_id INTEGER NOT NULL,
                    sale_date TEXT NOT NULL DEFAULT (datetime('now')),
                    subtotal_paise INTEGER NOT NULL DEFAULT 0,
                    discount_paise INTEGER NOT NULL DEFAULT 0,
                    total_cgst_paise INTEGER NOT NULL DEFAULT 0,
                    total_sgst_paise INTEGER NOT NULL DEFAULT 0,
                    total_gst_paise INTEGER NOT NULL DEFAULT 0,
                    grand_total_paise INTEGER NOT NULL DEFAULT 0,
                    payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'card', 'upi', 'credit')),
                    notes TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (customer_id) REFERENCES customers(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS sale_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER NOT NULL,
                    batch_id INTEGER NOT NULL,
                    medicine_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    unit_price_paise INTEGER NOT NULL,
                    discount_paise INTEGER NOT NULL DEFAULT 0,
                    taxable_amount_paise INTEGER NOT NULL,
                    cgst_rate REAL NOT NULL DEFAULT 0,
                    cgst_amount_paise INTEGER NOT NULL DEFAULT 0,
                    sgst_rate REAL NOT NULL DEFAULT 0,
                    sgst_amount_paise INTEGER NOT NULL DEFAULT 0,
                    total_paise INTEGER NOT NULL,
                    FOREIGN KEY (sale_id) REFERENCES sales(id),
                    FOREIGN KEY (batch_id) REFERENCES batches(id),
                    FOREIGN KEY (medicine_id) REFERENCES medicines(id)
                );

                CREATE TABLE IF NOT EXISTS prescriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    sale_id INTEGER,
                    doctor_name TEXT NOT NULL,
                    rx_number TEXT,
                    prescription_date TEXT NOT NULL,
                    notes TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (customer_id) REFERENCES customers(id),
                    FOREIGN KEY (sale_id) REFERENCES sales(id)
                );

                CREATE TABLE IF NOT EXISTS pharmacy_settings (
                    id INTEGER PRIMARY KEY CHECK(id = 1),
                    name TEXT NOT NULL DEFAULT 'My Pharmacy',
                    address TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    email TEXT,
                    gstin TEXT NOT NULL DEFAULT '',
                    drug_license_no TEXT NOT NULL DEFAULT '',
                    state_code TEXT NOT NULL DEFAULT '',
                    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
                    next_invoice_number INTEGER NOT NULL DEFAULT 1,
                    low_stock_threshold INTEGER NOT NULL DEFAULT 20,
                    near_expiry_days INTEGER NOT NULL DEFAULT 90,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
                CREATE INDEX IF NOT EXISTS idx_batches_medicine_id ON batches(medicine_id);
                CREATE INDEX IF NOT EXISTS idx_batches_expiry_date ON batches(expiry_date);
                CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);
                CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
                CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
                CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
                CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
                CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
                CREATE INDEX IF NOT EXISTS idx_prescriptions_customer_id ON prescriptions(customer_id);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed default data",
            sql: r#"
                INSERT OR IGNORE INTO gst_slabs (rate, description) VALUES (0, 'GST Exempt (0%)');
                INSERT OR IGNORE INTO gst_slabs (rate, description) VALUES (5, 'GST 5% (Most medicines post Sep 2025)');
                INSERT OR IGNORE INTO gst_slabs (rate, description) VALUES (12, 'GST 12%');
                INSERT OR IGNORE INTO gst_slabs (rate, description) VALUES (18, 'GST 18%');

                INSERT OR IGNORE INTO users (username, password_hash, full_name, role, is_active)
                VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Administrator', 'admin', 1);

                INSERT OR IGNORE INTO pharmacy_settings (id, name, address, phone, gstin, drug_license_no, state_code)
                VALUES (1, 'My Pharmacy', '123 Main Street', '0000000000', '', '', '');
            "#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pharmacare.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
