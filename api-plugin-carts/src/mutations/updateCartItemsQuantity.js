import SimpleSchema from "simpl-schema";
import getCartById from "../util/getCartById.js";

const inputSchema = new SimpleSchema({
  "cartId": String,
  "items": {
    type: Array,
    minCount: 1
  },
  "items.$": Object,
  "items.$.cartItemId": String,
  "items.$.quantity": {
    type: SimpleSchema.Integer,
    min: 0
  },
  "cartToken": {
    type: String,
    optional: true
  }
});

/**
 * @method updateCartItemsQuantity
 * @summary Sets a new quantity for one or more items in a cart
 * @param {Object} context -  an object containing the per-request state
 * @param {Object} input - Necessary input
 * @param {String} input.cartId - The ID of the cart in which all of the items exist
 * @param {String} input.items - Array of items to update
 * @param {Number} input.items.cartItemId - The cart item ID
 * @param {Object} input.items.quantity - The new quantity, which must be an integer of 0 or greater
 * @param {String} input.cartToken - The cartToken if the cart is an anonymous cart
 * @returns {Promise<Object>} An object containing the updated cart in a `cart` property
 */
export default async function updateCartItemsQuantity(context, input) {
  inputSchema.validate(input || {});

  const { cartId, items, cartToken } = input;

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
  
  const updatedItems = cart.items.reduce((list, item) => {
    const update = items.find(({ cartItemId }) => cartItemId === item._id);
    if (!update) {
      list.push({ ...item });
    } else if (update.quantity > 0) {
      // Update quantity as instructed, while omitting the item if quantity is 0
      list.push({
        ...item,
        quantity: update.quantity,
        // Update the subtotal since it is a multiple of the price
        subtotal: {
          amount: item.price.amount * update.quantity,
          currencyCode: item.subtotal.currencyCode
        }
      });
    }
    return list;
  }, []);

  const updatedCart = {
    ...cart,
    items: updatedItems,
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
