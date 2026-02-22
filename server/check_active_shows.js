import mongoose from 'mongoose';
import 'dotenv/config';
import fs from 'fs';
import Show from './models/Show.js';
import Movie from './models/Movie.js';

async function checkActiveShows() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        log('Connecting to ticket-booking db...');
        const uri = `${process.env.MONGODB_URI}/ticket-booking`;
        await mongoose.connect(uri);
        log('Connected');

        const now = new Date();
        log('Current Server Time: ' + now.toISOString());
        log('Current Local Time: ' + now.toLocaleString());

        const activeShows = await Show.find({ showDateTime: { $gte: now } }).populate('movie');
        log('Active Shows Count: ' + activeShows.length);

        activeShows.forEach(s => {
            log(`- ShowID: ${s._id}, Movie: ${s.movie ? s.movie.title : 'NULL'}, Time: ${s.showDateTime.toISOString()}`);
        });

        if (activeShows.length === 0) {
            log('\nChecking ALL shows to see why they are not active:');
            const allShows = await Show.find({}).sort({ showDateTime: -1 }).limit(5);
            allShows.forEach(s => {
                log(`- ShowID: ${s._id}, Time: ${s.showDateTime.toISOString()} (Past: ${s.showDateTime < now})`);
            });
        }

    } catch (error) {
        log('Error: ' + error.message);
    } finally {
        fs.writeFileSync('active_shows_check.txt', output);
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkActiveShows();
