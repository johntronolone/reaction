//import SimpleSchema from "simpl-schema";
//import ReactionError from "@reactioncommerce/reaction-error";
//import getCartById from "../util/getCartById.js";

export default async function removeFulfillmentOptionForGroup(context) {
  //TODO: imports

  const cart = await getCartById(context, cartId, { cartToken, throwIfNotFound: true });

  //console.log({cart});

  //TODO: cart modifications to remove selected option
  // it seems that cart.shipping is the only thing changed by selectFulfillmentOptionForGroup (verify this)
  // if (cart.shipping) { ... } else { ... }
  // => confirm that i dont need to do anything with cart.items
  

  //TODO: figure out return statement
  //return { cart: savedCart };

  //TODO: make a button that calls this in the front end
  // (also make set shipping address call this function)o
  
  //TODO: update schema in api-plugin-carts/src/schemas/checkout.schema
  //TODO: update storefront/src/containers/cart/mutations.gql
}
