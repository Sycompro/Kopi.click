import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = 'postgresql://postgres:KHCrtoiAtjXemsunDnduXbGhRtbXhBNt@maglev.proxy.rlwy.net:41191/railway';

async function runSchema() {
    const pool = new pg.Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log('Conectando a Railway PostgreSQL...');
        const client = await pool.connect();
        console.log('✅ Conectado!');

        const schemaPath = path.join(__dirname, '..', 'src', 'api', 'db', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        console.log('Ejecutando schema...');
        await client.query(schema);
        console.log('✅ Schema ejecutado correctamente!');

        // Verificar tablas creadas
        const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name;
    `);

        console.log('\nTablas creadas:');
        tables.rows.forEach(row => console.log('  - ' + row.table_name));

        client.release();
        await pool.end();
        console.log('\n✅ Base de datos de Kopi configurada exitosamente!');
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

runSchema();
