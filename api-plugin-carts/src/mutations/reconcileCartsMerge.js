import ReactionError from "@reactioncommerce/reaction-error";
import addCartItems from "../util/addCartItems.js";

/**
 * @summary Update account cart to have only the anonymous cart items, delete anonymous
 *   cart, and return updated accountCart.
 * @param {Object} accountCart The account cart document
 * @param {Object} anonymousCart The anonymous cart document
 * @param {Object} anonymousCartSelector The MongoDB selector for the anonymous cart
 * @param {Object} context App context
 * @returns {Object} The updated account cart
 */
export default async function reconcileCartsMerge({
  accountCart,
  anonymousCart,
  anonymousCartSelector,
  context
}) {
  const { collections } = context;
  const { Cart } = collections;

  async function removeDiscounts(cartWithDiscount) { 
    const cartWithoutDiscount = await context.mutations.removeDiscountCodeFromCart(context, { 
      cartId: cartWithDiscount._id,
      discountId: cartWithDiscount.billing[0]._id,
      shopId: cartWithDiscount.shopId,
      token: null
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
  // Convert item schema to input item schema
  const itemsInput = (anonymousCart.items || []).map((item) => ({
    metafields: item.metafields,
    price: item.price,
    productConfiguration: {
      productId: item.productId,
      productVariantId: item.variantId
    },
    quantity: item.quantity
  }));

  // Merge the item lists
  const { updatedItemList: items } = await addCartItems(context, accountCart.items, itemsInput, {
    skipPriceCheck: true
  });

  const updatedCart = {
    ...accountCart,
    items,
    updatedAt: new Date()
  };

  if (accountCart.billing && accountCart.billing[0]) {
    if (accountCart.shipping && accountCart.shipping[0] && accountCart.shipping[0]._id && accountCart.shipping[0].shipmentMethod && accountCart.shipping[0].shipmentMethod._id) {
      // discount code and shipping surcharge
      const newCart = await saveCart().then(xCart => removeDiscounts(xCart)).then(xCart => selectFulfillmentOption(xCart));
      return  newCart ;
    }
    // discount code only
    const newCart = await saveCart().then(xCart => removeDiscounts(xCart));
    return newCart ;
  } 

  if (accountCart.shipping && accountCart.shipping[0] && accountCart.shipping[0]._id && accountCart.shipping[0].shipmentMethod && accountCart.shipping[0].shipmentMethod._id) {
    // shipping surcharge only
    const newCart = await saveCart().then(xCart => selectFulfillmentOption(xCart));
    return newCart;
  }
  

  const savedCart = await context.mutations.saveCart(context, updatedCart);

  // Delete anonymous cart
  const { deletedCount } = await Cart.deleteOne(anonymousCartSelector);
  if (deletedCount === 0) throw new ReactionError("server-error", "Unable to delete anonymous cart");

  return savedCart;
}
