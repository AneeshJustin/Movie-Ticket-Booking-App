import mongoose from 'mongoose';
import 'dotenv/config';
import Movie from './models/Movie.js';

async function listMovies() {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/movie-ticket`);
        const movies = await Movie.find({});
        console.log('Movies in DB:', movies.map(m => ({ id: m._id, title: m.title })));
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}
listMovies();
