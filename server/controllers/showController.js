import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";


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
export const addShow = async (req,res)=>{
    try {
        const {movieId,showsInput,showPrice} = req.body
        let movie = await Movie.findById(movieId)

        if(!movie){
            //Fetch movie details and credits from TMDB API
            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`,{
            headers: {Authorization: `Bearer ${process.env.TMDB_API_KEY}`}
                }),
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`,{
                    headers: {Authorization: `Bearer ${process.env.TMDB_API_KEY}`}
                })
            ])
            const movieApiData = movieDetailsResponse.data
            const movieCreditsData = movieCreditsResponse.data

const movieDetails = {
    _id: movieId,
    title: movieApiData.title,
    overview: movieApiData.overview,
    poster_path: movieApiData.poster_path,
    backdrop_path: movieApiData.backdrop_path,
    release_date: movieApiData.release_date,
    original_language: movieApiData.original_language,
    tagline: movieApiData.tagline || '',
    genres: movieApiData.genres,
    vote_average: movieApiData.vote_average,
    runtime: movieApiData.runtime,
    casts: movieCreditsData.cast
}
// Add movie to database

 movie = await Movie.create(movieDetails)
        }

        const showsToCreate = []
        console.log('Adding shows for movie:', movieId)
        console.log('Shows Input:', JSON.stringify(showsInput))

        showsInput.forEach(show => {
            const showDate = show.date
            show.time.forEach((time) => {
                // Ensure time has seconds for reliable Date constructor across browsers
                const dateTimeString = `${showDate}T${time}:00`
                const showDateTime = new Date(dateTimeString)

                if (isNaN(showDateTime.getTime())) {
                    console.error('Invalid Date constructed:', dateTimeString)
                    return
                }

                showsToCreate.push({
                    movie: movieId,
                    showDateTime,
                    showPrice,
                    occupiedSeats: {}
                })
            })
        })

        if (showsToCreate.length > 0) {
            const result = await Show.insertMany(showsToCreate)
            console.log('Shows created successfully:', result.length)
            res.json({ success: true, message: `${result.length} Show(s) added successfully` })
        } else {
            console.log('No valid shows created from input')
            res.json({ success: false, message: 'No valid show dates/times provided' })
        }
    } catch (error) {
        console.error('Error in addShow:', error)
        res.json({ success: false, message: error.message })
    }
}
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