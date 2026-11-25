# PostgreSQL Data Lineage & FDW Visualizer (Full Docker)

Aplikasi visualisasi data lineage dan topologi antar-database PostgreSQL berbasis **Docker & Docker Compose**. Aplikasi ini mendeteksi koneksi dan aliran data lintas database yang menggunakan **`postgres_fdw`** (Foreign Data Wrapper) serta menganalisis aturan otentikasi jaringan dari **`pg_hba.conf`**.

---

## 🌟 Fitur Utama

1. **Automated Cross-DB Lineage Discovery (`postgres_fdw`)**:
   - Mendeteksi `FOREIGN SERVER`, `USER MAPPING`, dan `FOREIGN TABLE` antar-database secara otomatis via PostgreSQL system catalog (`pg_foreign_table`, `pg_foreign_server`, `information_schema`).
   - Melacak ketergantungan view lokal maupun lintas database (`pg_depend`).
2. **Interactive Node Graph GUI (React Flow)**:
   - Visualisasi grafis interaktif dengan arah aliran data animasi (Source Table ──► Foreign Table ──► Views).
   - Indikator khusus untuk membedakan `BASE TABLE`, `FOREIGN TABLE`, dan `VIEW`.
   - Filter per database dan pencarian instan berdasarkan nama tabel, skema, atau kolom.
3. **Inspector Drawer**:
   - Menampilkan detail metadata tabel: daftar seluruh kolom, tipe data, status `NOT NULL`, ordinal position.
   - Menampilkan opsi konfigurasi remote FDW (`foreign_server`, `remote_schema`, `remote_table`).
4. **`pg_hba.conf` Inspector & Topology**:
   - Membaca dan menampilkan aturan `pg_hba_file_rules` per database (IP / CIDR whitelist, metode otentikasi `scram-sha-256`/`md5`/`trust`).
5. **Multi-Database Cluster Demo**:
   - **`postgres-core`** (Port 5432): OLTP (`users`, `orders`, `products`, `payments`).
   - **`postgres-logistics`** (Port 5433): Logistik yang mengimpor tabel luar dari `core` via `postgres_fdw`.
   - **`postgres-analytics`** (Port 5434): Datamart & DWH yang mengimpor tabel luar dari `core` dan `logistics` sekaligus.

---

## 🚀 Cara Menjalankan

### 1. Prasyarat
- Docker Desktop (atau Docker Engine + Docker Compose) terpasang dan berjalan di komputer Anda.

### 2. Jalankan Cluster
Cukup jalankan satu perintah berikut di direktori proyek:

```bash
docker compose up --build -d
```

### 3. Akses Layanan

| Layanan | URL / Port | Keterangan |
| :--- | :--- | :--- |
| **Web GUI** | [http://localhost:3000](http://localhost:3000) | Tampilan visualisasi data lineage & pg_hba |
| **Backend REST API** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI FastAPI |
| **PostgreSQL Core** | `localhost:5432` (`core_db`) | User: `postgres`, Password: `postgres123` |
| **PostgreSQL Logistics** | `localhost:5433` (`logistics_db`) | User: `postgres`, Password: `postgres123` |
| **PostgreSQL Analytics** | `localhost:5434` (`analytics_db`) | User: `postgres`, Password: `postgres123` |

---

## 🔍 Menguji Data Lineage Langsung via PostgreSQL CLI

Anda dapat menguji bahwa Foreign Data Wrapper (`postgres_fdw`) benar-benar membaca data lintas database secara langsung:

### Query Cross-Database dari `postgres-analytics`:
```bash
docker exec -it postgres-analytics psql -U postgres -d analytics_db -c "
SELECT 
    order_number, 
    customer_name, 
    total_amount, 
    carrier, 
    fulfillment_hub 
FROM datamart.v_cross_db_sales_fulfillment;
"
```
*Query di atas menggabungkan data pelanggan dan pesanan dari `postgres-core` dengan data pengiriman dari `postgres-logistics` secara langsung via FDW!*

---

## 📂 Struktur Direktori Proyek

```
DATA LINEAGE/
├── docker-compose.yml              # Orkestrasi 3 PG + Backend + Frontend
├── .env.example                    # Contoh variabel lingkungan
├── README.md                       # Dokumentasi lengkap
├── database-init/
│   ├── core/
│   │   └── 01-schema-and-data.sql  # Inisialisasi DB Core (Sales, Users)
│   ├── logistics/
│   │   └── 01-init-fdw.sql         # FDW ke Core + data logistik
│   └── analytics/
│       └── 01-init-fdw-and-views.sql # FDW ke Core & Logistics + Datamart views
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                 # FastAPI App
│       ├── config.py               # Konfigurasi koneksi PG
│       ├── models/
│       │   └── schema.py           # Pydantic models (Nodes, Edges, HBA)
│       ├── extractor/
│       │   ├── db_client.py        # PostgreSQL client & test connection
│       │   ├── fdw_scanner.py      # Scanner pg_foreign_table & catalog
│       │   └── hba_scanner.py      # Scanner pg_hba_file_rules
│       ├── graph/
│       │   └── graph_builder.py    # Mengubah catalog jadi graph React Flow
│       └── api/
│           └── routes.py           # REST endpoints
└── frontend/
    ├── Dockerfile                  # Multi-stage build (Vite + Nginx)
    ├── nginx.conf                  # Nginx proxy ke backend
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx                 # Main layout & state
        ├── main.jsx
        ├── index.css
        ├── components/
        │   ├── Topbar.jsx          # Header, stats, search, DB selector
        │   ├── Canvas.jsx          # React Flow Canvas
        │   ├── CustomNodes.jsx     # Table & FDW Node component
        │   ├── InspectorDrawer.jsx # Detail kolom & FDW options
        │   └── HbaTopologyModal.jsx# Tabel aturan pg_hba.conf
        └── services/
            └── api.js              # Client HTTP API
```

---

## 🛑 Menghentikan Layanan

Untuk menghentikan semua container dan menghapus volumenya:

```bash
docker compose down -v
```
