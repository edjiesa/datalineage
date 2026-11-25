# PostgreSQL Data Lineage & FDW Visualizer (Docker)

Aplikasi pemantauan visual data lineage dan topologi otentikasi antar-database PostgreSQL berbasis **Docker & Docker Compose**. Dirancang khusus untuk memonitor **database PostgreSQL milik server Anda sendiri**, terutama yang saling terhubung menggunakan **`postgres_fdw`** (Foreign Data Wrapper) dan konfigurasi otentikasi **`pg_hba.conf`**.

---

## 🌟 Fitur Utama

1. **Monitor Database Milik Anda Sendiri**:
   - Tidak memerlukan database dummy. Anda cukup mendaftarkan koneksi (Host, Port, User, Password, DB Name) database PostgreSQL Anda.
   - Konfigurasi database tersimpan secara permanen di file `config/databases.json` (tetap tersimpan saat container di-restart).
2. **Automated Cross-DB Lineage Discovery (`postgres_fdw`)**:
   - Mendeteksi `FOREIGN SERVER`, `USER MAPPING`, dan `FOREIGN TABLE` antar-database secara otomatis via PostgreSQL system catalog (`pg_foreign_table`, `pg_foreign_server`, `information_schema`).
   - Melacak dependensi view lokal maupun cross-database (`pg_depend`).
   - Jika tabel foreign merujuk ke database remote yang belum didaftarkan, sistem secara otomatis menggambarkan node sumber eksternal (`Remote Source Table`) sehingga aliran data tetap terlihat utuh.
3. **Interactive Node Graph GUI (React Flow)**:
   - Visualisasi grafis interaktif dengan arah aliran data animasi (Source Table ──► Foreign Table ──► Views).
   - Indikator pembeda visual `BASE TABLE`, `FOREIGN TABLE`, dan `VIEW`.
   - Filter per database dan pencarian tabel/kolom secara instan.
4. **Inspector Drawer**:
   - Menampilkan detail metadata tabel: daftar kolom, tipe data, status `NOT NULL`, dan ordinal position.
   - Menampilkan opsi konfigurasi remote FDW (`foreign_server`, `remote_schema`, `remote_table`).
5. **`pg_hba.conf` Inspector & Topology**:
   - Membaca dan menampilkan aturan `pg_hba_file_rules` per database (IP / CIDR whitelist, metode otentikasi `scram-sha-256`/`md5`/`trust`).

---

## 🚀 Cara Menjalankan

### 1. Jalankan Container (Hanya Backend & Frontend)

```bash
docker compose up --build -d
```

Setelah berjalan:
- **Web GUI**: Buka browser di [http://localhost:3000](http://localhost:3000) (atau IP server Anda: `http://<IP_SERVER>:3000`)
- **Backend REST API**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🔌 Cara Menghubungkan Database Anda

Ada 2 cara mudah untuk mendaftarkan database PostgreSQL Anda:

### Cara 1: Melalui Web GUI (Paling Mudah)
1. Buka [http://localhost:3000](http://localhost:3000).
2. Klik tombol **Manage DBs** di pojok kanan atas.
3. Masukkan koneksi PostgreSQL Anda:
   - **Label**: Nama alias (misal: `db-production`, `db-analytics`)
   - **Host**: 
     - Jika database berada di mesin host yang sama dengan Docker: gunakan **`host.docker.internal`**
     - Jika berada di server/IP lain: masukkan IP LAN atau IP Public PostgreSQL Anda (misal: `192.168.1.50`)
   - **Port**: `5432` (default)
   - **Database Name**, **User**, dan **Password**
4. Klik tombol **Test Connection** untuk memastikan koneksi berhasil.
5. Klik **Simpan & Scan**. Graf data lineage akan langsung ter-render otomatis!

### Cara 2: Melalui File `config/databases.json`
Anda juga bisa mengisi file `config/databases.json` secara langsung:

```json
[
  {
    "name": "db-production",
    "host": "host.docker.internal",
    "port": 5432,
    "dbname": "production_db",
    "user": "postgres",
    "password": "secret_password"
  },
  {
    "name": "db-analytics",
    "host": "192.168.1.60",
    "port": 5432,
    "dbname": "analytics_db",
    "user": "postgres",
    "password": "secret_password"
  }
]
```

---

## 🛑 Menghentikan Layanan

```bash
docker compose down
```
