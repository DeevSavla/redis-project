export function getKeyName(...args:string[]){
    return `bites:${args.join(":")}`
}

export const restaurantKetById = (id:string) => getKeyName("restaurants",id);

