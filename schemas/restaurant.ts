import { z } from "zod";

export const restaurantSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  cuisines: z.array(z.string().min(1)).min(1),
});

export const restaurantDetailsSchema = z.object({
  links: z.array(z.object({
    name: z.string().min(1),
    url: z.string().min(1),
    contact: z.object({
        phone: z.string().min(1),
        email: z.email()
    })
  })),
});

export type Restaurant = z.infer<typeof restaurantSchema>
export type RestaurantDetails = z.infer<typeof restaurantDetailsSchema>
