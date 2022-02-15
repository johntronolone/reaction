import SimpleSchema from "simpl-schema";
import Random from "@reactioncommerce/random";
import { CartAddress as AddressSchema } from "../simpleSchemas.js";
import getCartById from "../util/getCartById.js";

const inputSchema = new SimpleSchema({
  address: AddressSchema,
  addressId: {
    type: String,
    optional: true
  },
  cartId: String,
  cartToken: {
    type: String,
    optional: true
  }
});

/**
 * @method setShippingAddressOnCart
 * @summary Sets the shippingAddress data for all fulfillment groups on a cart that have
 *   a type of "shipping"
 * @param {Object} context - an object containing the per-request state
 * @param {Object} input - Input (see SimpleSchema)
 * @returns {Promise<Object>} An object with a `cart` property containing the updated cart
 */
export default async function setShippingAddressOnCart(context, input) {
  const cleanedInput = inputSchema.clean(input); // add default values and such
  inputSchema.validate(cleanedInput);

  const { address, addressId, cartId, cartToken } = cleanedInput;
  address._id = addressId || Random.id();

  const cart = await getCartById(context, cartId, { cartToken, throwIfNotFound: true });
    
  async function removeDiscounts(cartWithDiscount) { 
    const cartWithoutDiscount = await context.mutations.removeDiscountCodeFromCart(context, { 
      cartId: cartWithDiscount._id,
      discountId: cartWithDiscount.billing[0]._id,
      shopId: cartWithDiscount.shopId,
      token: cartToken || null
    });
    return cartWithoutDiscount;
  }
  
  async function selectFulfillmentOption(cartWithOldShippingRate) {
    const cartUpdatedShipping = await context.mutations.selectFulfillmentOptionForGroup(context, {
      cartId: cartWithOldShippingRate._id,
      fulfillmentGroupId: cartWithOldShippingRate.shipping[0]._id,
      fulfillmentMethodId: cartWithOldShippingRate.shipping[0].shipmentMethod._id
    });
    // for some reason the above mutation returns cart object unlike the others...
    return cartUpdatedShipping.cart;
  }
  
  async function saveCart() {
    const savedCart = await context.mutations.saveCart(context, updatedCart);
    return savedCart;
  }

  let didModify = false;
  const updatedFulfillmentGroups = (cart.shipping || []).map((group) => {
    if (group.type === "shipping") {
      didModify = true;
      return { ...group, address };
    }
    return group;
  });

  if (!didModify) return { cart };

  const updatedCart = {
    ...cart,
    shipping: updatedFulfillmentGroups,
    updatedAt: new Date()
  };
  
  if (cart.billing && cart.billing[0]) {
    if (cart.shipping && cart.shipping[0] && cart.shipping[0]._id && cart.shipping[0].shipmentMethod && cart.shipping[0].shipmentMethod._id) {
      // discount code and shipping surcharge
      const newCart = await saveCart().then(xCart => removeDiscounts(xCart)).then(xCart => selectFulfillmentOption(xCart));
      return { cart: newCart };
    }
    // discount code only
    const newCart = await saveCart().then(xCart => removeDiscounts(xCart));
    return { cart: newCart };
  } 

  if (cart.shipping && cart.shipping[0] && cart.shipping[0]._id && cart.shipping[0].shipmentMethod && cart.shipping[0].shipmentMethod._id) {
    // shipping surcharge only
    const newCart = await saveCart().then(xCart => selectFulfillmentOption(xCart));
    return { cart: newCart };
  }
  const savedCart = await context.mutations.saveCart(context, updatedCart);

  return { cart: savedCart };
}
