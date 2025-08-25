import express, { type Request } from "express";
import { validate } from "../middlewares/validate.js";
import { restaurantSchema, type Restaurant } from "../schemas/restaurant.js";
import { initialiseRedisClient } from "../utils/client.js";
import { nanoid } from "nanoid";
import {
  restaurantKeyById,
  reviewKeyById,
  reviewDetailsKeyById,
  cuisineKey,
  cuisinesKey,
  restaurantCuisinesKeyById,
} from "../utils/keys.js";
import { errorResponse, successResponse } from "../utils/responses.js";
import { checkRestaurantExists } from "../middlewares/checkRestaurantId.js";
import { reviewSchema, type Review } from "../schemas/reviews.js";
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
    await Promise.all([
      ...data.cuisines.map((cuisine) =>
        Promise.all([
          //this will add the cuisine to global set of all cuisines stores 
          client.sAdd(cuisinesKey, cuisine),
          //this will add the id of restaurant in the set which serves that cuisine
          client.sAdd(cuisineKey(cuisine), id),
          //this will add the cuisine in the set of restaurant of cuisines it serves
          client.sAdd(restaurantCuisinesKeyById(id), cuisine),
        ])
      ),
      client.hSet(restaurantKey, hashData),
    ]);
    return successResponse(res, hashData, "Added new restaurant");
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:restaurantId/reviews",
  checkRestaurantExists,
  validate(reviewSchema),
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    const data = req.body as Review;
    try {
      const client = await initialiseRedisClient();
      const reviewId = nanoid();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewDetailsKey = reviewDetailsKeyById(reviewId);
      const reviewData = {
        id: reviewId,
        ...data,
        timestamp: Date.now(),
        restaurantId,
      };
      await Promise.all([
        client.lPush(reviewKey, reviewId),
        client.hSet(reviewDetailsKey, reviewData),
      ]);
      return successResponse(res, reviewData, "Review added");
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:restaurantId/reviews",
  checkRestaurantExists,
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    //this brings the top limit reviews for that restaurant, here limit = 1 means brings latest one review only.
    const { page = 1, limit = 1 } = req.query;
    const start = (Number(page) - 1) * Number(limit);
    const end = start + Number(limit) - 1;
    try {
    } catch (error) {}
    try {
      const client = await initialiseRedisClient();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewIds = await client.lRange(reviewKey, start, end);
      const reviews = await Promise.all(
        reviewIds.map((id) => client.hGetAll(reviewDetailsKeyById(id)))
      );
      return successResponse(
        res,
        reviews,
        `Fetched all reviews for ${restaurantId}`
      );
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:restaurantId/reviews/reviewId",
  checkRestaurantExists,
  async (
    req: Request<{ restaurantId: string; reviewId: string }>,
    res,
    next
  ) => {
    const { restaurantId, reviewId } = req.body;
    try {
      const client = await initialiseRedisClient();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewDetailsKey = reviewDetailsKeyById(reviewId);
      const [removeResult, deleteResult] = await Promise.all([
        //go to reviewkey and remove all reviews with that id
        client.lRem(reviewKey, 0, reviewId),
        client.del(reviewDetailsKey),
      ]);
      if (removeResult == 0 && deleteResult == 0) {
        return errorResponse(res, 404, "Review not found");
      }
      return successResponse(res, reviewId, `Review ${reviewId} deleted.`);
    } catch (error) {
      next(error);
    }
  }
);

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
      const [viewCount, restaurant, cuisines] = await Promise.all([
        //tells how many users has viewed or searched that restaurant.
        client.hIncrBy(restaurantKey, "viewCount", 1),
        client.hGetAll(restaurantKey),
        //fetches all the cuisines served by that restaurant
        client.sMembers(restaurantCuisinesKeyById(restaurantId))
      ]);
      return successResponse(res, {...restaurant,cuisines}, "Fetched Restaurant");
    } catch (error) {
      next(error);
    }
  }
);

export default router;
