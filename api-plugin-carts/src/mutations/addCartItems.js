import hashToken from "@reactioncommerce/api-utils/hashToken.js";
import ReactionError from "@reactioncommerce/reaction-error";
import addCartItemsUtil from "../util/addCartItems.js";

/**
 * @method addCartItems
 * @summary Add one or more items to a cart
 * @param {Object} context -  an object containing the per-request state
 * @param {Object} input - mutation input
 * @param {Object} [options] - Options
 * @param {Boolean} [options.skipPriceCheck] - For backwards compatibility, set to `true` to skip checking price.
 *   Skipping this is not recommended for new code.
 * @returns {Promise<Object>} An object with `cart`, `minOrderQuantityFailures`, and `incorrectPriceFailures` properties.
 *   `cart` will always be the full updated cart document, but `incorrectPriceFailures` and
 *   `minOrderQuantityFailures` may still contain other failures that the caller should
 *   optionally retry with the corrected price or quantity.
 */
export default async function addCartItems(context, input, options = {}) {
  const { cartId, items, cartToken } = input;
  const { collections, accountId = null } = context;
  const { Cart } = collections;

  let selector;
  if (accountId) {
    // Account cart
    selector = { _id: cartId, accountId };
  } else {
    // Anonymous cart
    if (!cartToken) {
      throw new ReactionError("not-found", "Cart not found");
    }

    selector = { _id: cartId, anonymousAccessToken: hashToken(cartToken) };
  }

  const cart = await Cart.findOne(selector);
  if (!cart) {
    throw new ReactionError("not-found", "Cart not found");
  }

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

  const {
    incorrectPriceFailures,
    minOrderQuantityFailures,
    updatedItemList
  } = await addCartItemsUtil(context, cart.items, items, { skipPriceCheck: options.skipPriceCheck });

  const updatedCart = {
    ...cart,
    items: updatedItemList,
    updatedAt: new Date()
  };
  
  // TODO: remove all TODO's

  // TODO: see if cart object is the same
  if (cart.billing && cart.billing[0]) {
    if (cart.shipping && cart.shipping[0] && cart.shipping[0]._id && cart.shipping[0].shipmentMethod && cart.shipping[0].shipmentMethod._id) {
      // discount code and shipping surcharge
      const newCart = await saveCart().then(xCart => removeDiscounts(xCart)).then(xCart => selectFulfillmentOption(xCart));
      // TODO: update return with extra info
      return { cart: newCart, incorrectPriceFailures, minOrderQuantityFailures};
    }
    // discount code only
    const newCart = await saveCart().then(xCart => removeDiscounts(xCart));
    // TODO: update return with extra info
    return { cart: newCart, incorrectPriceFailures, minOrderQuantityFailures };
  } 

  if (cart.shipping && cart.shipping[0] && cart.shipping[0]._id && cart.shipping[0].shipmentMethod && cart.shipping[0].shipmentMethod._id) {
    // shipping surcharge only
    const newCart = await saveCart().then(xCart => selectFulfillmentOption(xCart));
    // TODO: update return with extra info
    return { cart: newCart, incorrectPriceFailures, minOrderQuantityFailures };
  }
  
  // TODO: conditional remove discount, shipping
  const savedCart = await context.mutations.saveCart(context, updatedCart);

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

  return { cart: savedCart, incorrectPriceFailures, minOrderQuantityFailures };
}
