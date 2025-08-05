import express from 'express'
import cuisineRouter from './routes/cuisines.js'
import restaurantRouter from './routes/restaurants.js'
import { errorHandler } from './middlewares/errorHandler.js'

const PORT = process.env.PORT

const app = express()

app.use(express.json())
app.use('/restaurants',restaurantRouter)
app.use('/cuisines',cuisineRouter)

app.use(errorHandler)

app.listen(PORT,()=>(
    console.log(`Server running in port ${PORT}`)
)).on("error",(error)=>{
    throw new Error(error.message)
})