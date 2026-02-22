import mongoose from 'mongoose';
import 'dotenv/config';
import fs from 'fs';

async function checkAllDBs() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        log('Starting Global DB Check...');
        await mongoose.connect(process.env.MONGODB_URI);
        log('Connected to MongoDB Cluster');

        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        log('Available Databases:');
        for (const dbInfo of dbs.databases) {
            log(`- ${dbInfo.name}`);
            const db = mongoose.connection.useDb(dbInfo.name);
            const collections = await db.db.listCollections().toArray();
            for (const col of collections) {
                const count = await db.collection(col.name).countDocuments();
                log(`  -- ${col.name}: ${count} docs`);
                if (col.name === 'shows' && count > 0) {
                    const sample = await db.collection(col.name).findOne();
                    log(`     Sample Show: ${JSON.stringify(sample)}`);
                }
            }
        }

    } catch (error) {
        log('Error checking DB: ' + error.message);
    } finally {
        fs.writeFileSync('global_db_check.txt', output);
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkAllDBs();
