import SimpleSchema from "simpl-schema";
import hashToken from "@reactioncommerce/api-utils/hashToken.js";
import ReactionError from "@reactioncommerce/reaction-error";

const inputSchema = new SimpleSchema({
  "cartId": String,
  "cartItemIds": {
    type: Array,
    minCount: 1
  },
  "cartItemIds.$": String,
  "cartToken": {
    type: String,
    optional: true
  }
});

/**
 * @method removeCartItems
 * @summary Removes one or more items from a cart
 * @param {Object} context -  an object containing the per-request state
 * @param {Object} input - Necessary input
 * @param {String} input.cartId - The ID of the cart in which all of the items exist
 * @param {String[]} input.cartItemIds - Array of cart item IDs to remove
 * @param {String} input.cartToken - The cartToken if the cart is an anonymous cart
 * @returns {Promise<Object>} An object containing the updated cart in a `cart` property
 */
export default async function removeCartItems(context, input) {
  inputSchema.validate(input || {});

  const { accountId, collections } = context;
  const { Cart } = collections;
  const { cartId, cartItemIds, cartToken } = input;

  const selector = { _id: cartId };
  if (cartToken) {
    selector.anonymousAccessToken = hashToken(cartToken);
  } else if (accountId) {
    selector.accountId = accountId;
  } else {
    throw new ReactionError("invalid-param", "A cartToken is required when updating an anonymous cart");
  }
const cart = await Cart.findOne(selector);
  if (!cart) throw new ReactionError("not-found", "Cart not found");

  const updatedCart = {
    ...cart,
    items: cart.items.filter((item) => !cartItemIds.includes(item._id)),
    updatedAt: new Date()
  };

  
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

  // TODO: nuke this
  /*async function removeDiscounts(discountId) { 
    await context.mutations.removeDiscountCodeFromCart(context, { 
      cartId,
      discountId,
      shopId: cart.shopId,
      token: cartToken || null
    });
  }

  if (cart.billing) {
    for (const billingItem of cart.billing) {
      removeDiscounts(billingItem._id);
    }
  }*/

  const savedCart = await context.mutations.saveCart(context, updatedCart);

  return { cart: savedCart };
}
