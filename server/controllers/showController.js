import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";


//API to get now playing movies
export const getNowPlayingMovies = async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.themoviedb.org/3/movie/now_playing',
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        },
        timeout: 10000, // 10 seconds
      }
    )

    res.json({ success: true, movies: response.data.results })

  } catch (error) {
    console.error("TMDB ERROR:", error.code || error.message)

    if (error.code === "ECONNRESET") {
      return res.json({
        success: false,
        message: "TMDB connection reset. Try again."
      })
    }

    res.json({
      success: false,
      message: error.response?.data?.status_message || error.message
    })
  }
}



//API to add a new show to the database
export const addShow = async (req, res) => {
  try {
    const { movieId, showsInput, showPrice } = req.body;

    // ---------------- VALIDATION ----------------
    if (!movieId || !showsInput || !Array.isArray(showsInput)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input data",
      });
    }

    if (!showPrice) {
      return res.status(400).json({
        success: false,
        message: "Show price is required",
      });
    }

    // ---------------- FIND OR CREATE MOVIE ----------------
    let movie = await Movie.findById(movieId);

    if (!movie) {
      const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
          headers: {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          },
        }),
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
          headers: {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          },
        }),
      ]);

      const movieApiData = movieDetailsResponse.data;
      const movieCreditsData = movieCreditsResponse.data;

      movie = await Movie.create({
        _id: movieId,
        title: movieApiData.title,
        overview: movieApiData.overview,
        poster_path: movieApiData.poster_path,
        backdrop_path: movieApiData.backdrop_path,
        release_date: movieApiData.release_date,
        original_language: movieApiData.original_language,
        tagline: movieApiData.tagline || "",
        genres: movieApiData.genres,
        vote_average: movieApiData.vote_average,
        runtime: movieApiData.runtime,
        casts: movieCreditsData.cast,
      });
    }

    // ---------------- CREATE SHOWS ----------------
    const showsToCreate = [];

    console.log("Received showsInput:", JSON.stringify(showsInput));

    for (const show of showsInput) {
      if (!show.date || !Array.isArray(show.time)) continue;

      for (const time of show.time) {
        // Safe ISO format
        const showDateTime = new Date(`${show.date}T${time}:00.000Z`);

        if (!isNaN(showDateTime.getTime())) {
          showsToCreate.push({
            movie: movie._id,
            showDateTime,
            showPrice,
            occupiedSeats: {},
          });
        } else {
          console.log("Invalid Date:", show.date, time);
        }
      }
    }

    if (showsToCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid shows created. Check date/time format.",
      });
    }

    const insertedShows = await Show.insertMany(showsToCreate);

    return res.status(201).json({
      success: true,
      message: `${insertedShows.length} show(s) added successfully`,
      data: insertedShows,
    });
  } catch (error) {
    console.error("Error in addShow:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
//API to get all shows from the database
export const getShows = async (req,res)=>{
    try {
        const shows = await Show.find({}).populate('movie').sort({showDateTime:1})
        
        

        //Filer unique shows
        const uniqueShows = new Set(shows.map(show=>show.movie))
        res.json({success: true, shows: Array.from(uniqueShows)})
    } catch (error) {
        console.log(error)
        res.json({success: false, message: error.message})
    }
}

//API to get a single show from the database
export const getShow = async (req, res)=> {
    try {
        const {movieId} = req.params
        //get all upcoming shows for the movie
        const shows = await Show.find({movie: movieId, showDateTime: {$gte: new Date()}})
       
        const movie = await Movie.findById(movieId)
        const dateTime = {}
        shows.forEach((show) =>{
            const date = show.showDateTime.toISOString().split('T')[0]
            if(!dateTime[date]){
                dateTime[date] = []
            }
            dateTime[date].push({
                time: show.showDateTime, showId: show._id
            })
        })
        res.json({success: true, movie, dateTime})
    } catch (error) {
        console.log(error)
        res.json({success: false, message: error.message}) 
    }
}