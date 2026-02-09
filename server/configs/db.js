import mongoose from "mongoose";

const connectDB = async () => {
    try{
mongoose.connection.on("connected", ()=> console.log("MongoDB Connected"));

 await mongoose.connect(`${process.env.MONGODB_URI}/ticket-booking`)
    }
    catch(error){
        console.error(error);
    }
}

export default connectDB;