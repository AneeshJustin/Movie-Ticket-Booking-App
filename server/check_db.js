import mongoose from 'mongoose';
import 'dotenv/config';
import fs from 'fs';
import Movie from './models/Movie.js';
import Show from './models/Show.js';

async function checkDB() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        log('Starting DB Check...');
        // Use the same database name as in configs/db.js
        const uri = `${process.env.MONGODB_URI}/movie-ticket`;
        log('Connecting to: ' + uri.replace(/:([^:@]{1,})@/, ':****@')); // mask password
        await mongoose.connect(uri);
        log('Connected to MongoDB');

        const movieCount = await Movie.countDocuments();
        log('Total Movies: ' + movieCount);

        const showCount = await Show.countDocuments();
        log('Total Shows: ' + showCount);

        if (movieCount > 0) {
            const movie = await Movie.findOne();
            log('Sample Movie: ' + JSON.stringify(movie, null, 2));
        }

        if (showCount > 0) {
            const show = await Show.findOne().populate('movie');
            log('Sample Show (Populated): ' + JSON.stringify(show, null, 2));
        }

    } catch (error) {
        log('Error checking DB: ' + error.message);
        log(error.stack);
    } finally {
        fs.writeFileSync('db_check_result.txt', output);
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkDB();
