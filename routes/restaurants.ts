import express, { type Request } from "express";
import { validate } from "../middlewares/validate.js";
import { restaurantSchema, type Restaurant } from "../schemas/restaurant.js";
import { initialiseRedisClient } from "../utils/client.js";
import { nanoid } from "nanoid";
import { restaurantKeyById } from "../utils/keys.js";
import { successResponse } from "../utils/responses.js";
import { checkRestaurantExists } from "../middlewares/checkRestaurantId.js";
const router = express.Router();

router.post("/", validate(restaurantSchema), async (req, res, next) => {
  const data = req.body as Restaurant;
  try {
    const client = await initialiseRedisClient();
    const id = nanoid();
    const restaurantKey = restaurantKeyById(id);
    const hashData = {
      id,
      name: data.name,
      location: data.location,
      //did not add cuisines as it array of strings that hashes cannot handle
    };
    const addResult = await client.hSet(restaurantKey, hashData);
    console.log(`Added ${addResult} fields`);
    return successResponse(res, hashData, "Added new restaurant");
  } catch (error) {
    next(error);
  }
});

router.get(
  "/:restaurantId",
  checkRestaurantExists,
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    try {
      const client = await initialiseRedisClient();
      const restaurantKey = restaurantKeyById(restaurantId);
      //increments the view count of a restaurant in Redis and retrieves all its details, then stores the results in viewCount and restaurant.
      //promise.all helps to run multiple things in parallel
      const [viewCount, restaurant] = await Promise.all([
        //tells how many users has viewed or searched that restaurant.
        client.hIncrBy(restaurantKey, "viewCount", 1),
        client.hGetAll(restaurantKey),
      ]);
      return successResponse(res, restaurant, "Fetched Restaurant");
    } catch (error) {
      next(error);
    }
  }
);

export default router;
