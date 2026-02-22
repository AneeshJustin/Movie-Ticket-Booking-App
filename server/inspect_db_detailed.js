import mongoose from 'mongoose';
import 'dotenv/config';
import fs from 'fs';

async function inspectMovies() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        log('Connecting to movie-ticket db...');
        const uri = `${process.env.MONGODB_URI}/movie-ticket`;
        await mongoose.connect(uri);
        log('Connected');

        const collections = await mongoose.connection.db.listCollections().toArray();
        log('Collections: ' + collections.map(c => c.name).join(', '));

        const movies = await mongoose.connection.db.collection('movies').find({}).toArray();
        log('Movies count: ' + movies.length);
        movies.forEach(m => {
            log(`- ID: ${m._id}, Title: ${m.title}`);
        });

        const shows = await mongoose.connection.db.collection('shows').find({}).toArray();
        log('Shows count: ' + shows.length);
        shows.forEach(s => {
            log(`- ShowID: ${s._id}, MovieID: ${s.movie}, Time: ${s.showDateTime}`);
        });

    } catch (error) {
        log('Error: ' + error.message);
    } finally {
        fs.writeFileSync('db_inspection.txt', output);
        await mongoose.disconnect();
        process.exit(0);
    }
}

inspectMovies();
