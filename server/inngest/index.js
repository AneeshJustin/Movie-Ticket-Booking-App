import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";


// Create a client to send and receive events

export const inngest = new Inngest({ id: "ticket-booking" });

//Inngest Functions to save user data to the database
const syncUserCreation = inngest.createFunction(
    {
        id:'sync-user-from-clerk'
    },
    {
        event: 'clerk/user.created'
    },
    async({event})=>{
        const {id,first_name,last_name,email_addresses, image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.create(userData)
    }
)

//inngest Function to delete user from database

const syncUserDeletion = inngest.createFunction(
    {
        id:'delete-user-with-clerk'
    },
    {
        event: 'clerk/user.deleted'
    },
    async({event})=>{
        const {id} = event.data
        await User.findByIdAndDelete(id)
    }
)

//inngest Function to update user data in the database 

const syncUserUpdation = inngest.createFunction(
    {
        id:'update-user-from-clerk'
    },
    {
        event: 'clerk/user.updated'
    },
    async({event})=>{
        const {id,first_name,last_name,email_addresses, image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.findByIdAndUpdate(id,userData)
    }
    
)
//Ingest Funtion to cancel booking and release seats of show after 10 minutes of booking created if payment is not done

const releaseSeatsAndDeleteBooking = inngest.createFunction(
    {
        id: 'release-seats-delete-booking'
    },
    {
        event: 'app/checkpayment'
    },
    async({event,step})=>{
        const tenMinuteLater = new Date(Date.now() + 10 * 60 * 1000)
        await step.sleepUntil('wait-for-10-minutes', tenMinuteLater)
        await step.run('check-payment-status',async()=>{
            const bookingId=event.data.bookingId
            const booking = await Booking.findById(bookingId)

            //if payment is not made,release seats and delete booking
            if(!booking.isPaid){
           const show = await Show.findById(booking.show)
           booking.bookedSeats.forEach((seat)=>{
            delete show.occupiedSeats[seat]
           })
            show.markModified('occupiedSeats')
            await show.save()
           await Booking.findByIdAndDelete(bookingId)
            }
        })
        
    }
)    

// Inngest Function to send email to user after booking is created

const sendBookingConfirmationEmail = inngest.createFunction(
    {
        id: 'send-booking-confirmation-email'
    },
    {
        event: 'app/show.booked'
    },
    async({event,step})=>{
        const {bookingId} = event.data
        const booking = await Booking.findById(bookingId).populate({path:'show',
        populate:{path:'movie',model:'Movie'}
        }).populate('user')
 
await sendEmail({
    to: booking.user.email,
    subject: `Payment Confirmation: "${booking.show.movie.title}" booked!`,
    body: ` <div style='font-family: Arial, sans-serif; line-height: 1.5;'>
    <h2>Hi ${booking.user.name}</h2>
    <p>Your booking for <strong style='color: #F84565;'>"${booking.show.movie.title}"</strong> is confirmed!</p>
    <p>
    <strong>Date:</strong> ${new Date(booking.show.showDateTime).toLocaleDateString('en-US', {timeZone: 'Asia/Kolkata'})}<br/>
    <strong>Time:</strong> ${new Date(booking.show.showDateTime).toLocaleTimeString('en-US', {timeZone: 'Asia/Kolkata'})}
    </p>
    <p>Enjoy the Show!</p>
    <p>Best Regards</p>
    <p>Ticket Booking App</p>
    </div>`
})

    }

)
// Inngest Funtion to send reminders

const sendShowReminders = inngest.createFunction(
    {id: 'send-show-reminder'},
    {cron: '0 */8 * * *'}, // Every 8 hours
    async({step})=>{
        const now = new Date()
        const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000)
        const windowStart = new Date(in8Hours.getTime() - 10  * 60 * 1000)
   // Prepare reminder tasks
        const reminderTasks = await step.run('prepare-reminder-tasks',async()=>{
            const shows = await Show.find({
                showDateTime: {
                    $gte: windowStart,
                    $lt: in8Hours
                }
            }).populate('movie')
            const tasks = []
            for(const show of shows){
                if(!show.movie || !show.occupiedSeats) continue;
                const userId = [...new Set(Object.values(show.occupiedSeats))]
                if(userId.length === 0) continue;
                const users = await User.find({ _id: { $in: userId } }).select('email name')
                for (const user of users){
                    tasks.push({
                        userEmail: user.email,
                        userName: user.name,
                        movieTitle: show.movie.title,
                        showTime: show.showDateTime
                    })
                } 
            }
            return tasks
        })

        if(reminderTasks.length ===0){
            return {sent: 0, message: 'No reminders to send'}
        }
        // Send reminder emails
        const results = await step.run('send-all-reminders', async ()=>{
            const emailResults = await Promise.allSettled(reminderTasks.map(task => sendEmail({
                to: task.userEmail,
                subject: `Reminder: ${task.movieTitle} is about to start!`,
                body: `<div style='font-family: Arial, sans-serif; line-height: 1.5;'>
                <h2>Hi ${task.userName}</h2>
                <p>Your show <strong style='color: #F84565;'>"${task.movieTitle}"</strong> is about to start!</p>
                <p>
                <strong>Date:</strong> ${new Date(task.showTime).toLocaleDateString('en-US', {timeZone: 'Asia/Kolkata'})}<br/>
                <strong>Time:</strong> ${new Date(task.showTime).toLocaleTimeString('en-US', {timeZone: 'Asia/Kolkata'})}
                </p>
                <p>Enjoy the Show!</p>
                <p>Best Regards</p>
                <p>Ticket Booking App</p>
                </div>`
            })))
            const sent = emailResults.filter(r => r.status === 'fulfilled').length
            const failed = emailResults.length - sent
            return { sent, failed, message: `Sent ${sent}, Failed ${failed}` }
        })

        return results
    }
)
// Inngest Function to send new show notifications when a new show is created
const sendNewShowNotification = inngest.createFunction(
    {id:'send-new-show-notification'},
    {event: 'app/show.added'},
    async ({ event}) =>{
        const {movieTitle} = event.data
        const users = await User.find({})
        for (const user of users){
            const userEmail = user.email
            const userName = user.name
            const subject = `New Show Added: ${movieTitle}`
            const body = `<div style='font-family: Arial, sans-serif; line-height: 1.5;'>
            <h2>Hi ${userName}</h2>
            <p>A new show <strong style='color: #F84565;'>"${movieTitle}"</strong> has been added!</p>
            <p>Enjoy the Show!</p>
            <p>Best Regards</p>
            <p>Ticket Booking App</p>
            </div>`
            await sendEmail({
            to: userEmail,
            subject,
            body
        })
        }
return {message: 'Notifications sent successfully'}
    }
)


 
// Export all Inngest functions
export const functions = [
    syncUserCreation, 
    syncUserDeletion,
    syncUserUpdation,
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendShowReminders,
    sendNewShowNotification
];                