import ReactionError from "@reactioncommerce/reaction-error";
//import { decodeCartItemOpaqueId } from "../xforms/id.js";
import decodeOpaqueId from "@reactioncommerce/api-utils/decodeOpaqueId.js";

/**
 * @name discounts/codes/discount
 * @method
 * @memberof Discounts/Codes/Methods
 * @summary calculates percentage off discount rates
 * @param {String} cartId cartId
 * @param {String} discountId discountId
 * @param {Object} collections Map of MongoDB collections
 * @returns {Number} returns discount total
 */

export default async function getPercentageOffDiscount(cartId, discountId, collections) {
  const { Cart, Discounts } = collections;

  const discountMethod = await Discounts.findOne({ _id: discountId });
  if (!discountMethod) throw new ReactionError("not-found", "Discount not found");

  // For "discount" type discount, the `discount` string is expected to parse as a float, a percent
  const discountAmount = Number(discountMethod.discount);
  if (isNaN(discountAmount)) throw new ReactionError("invalid", `"${discountMethod.discount}" is not a number`);

  const cart = await Cart.findOne({ _id: cartId });
  if (!cart) throw new ReactionError("not-found", "Cart not found");

  let discount = 0;
  
  if (discountMethod.conditions.products && Array.isArray(discountMethod.conditions.products)) {
    // add discounts per item basis
    let opaqueIdArray = [];
    for (const id of discountMethod.conditions.products) {
      const { id: productId } = decodeOpaqueId(id);
      opaqueIdArray.push(productId);
    }
    for (const item of cart.items) {
      //throw new ReactionError("invalid", `"${item.productId}"`);
      if (opaqueIdArray.includes(item.productId)) {
        discount += item.subtotal.amount * discountAmount / 100;
      }
    }
  } else { 
    // add discounts to all items
    for (const item of cart.items) {
      discount += item.subtotal.amount * discountAmount / 100;
    }
  }
  
  const { taxSummary} = cart; 
  let taxDiscount = 0;
  let discountPercent = 0;

  if (taxSummary) {
    const { tax, taxableAmount } = taxSummary;
    if (tax && taxableAmount) {
      //taxPercent = tax/taxableAmount;
      discountPercent = discount/taxableAmount;
      taxDiscount = tax*discountPercent;
      discount += taxDiscount;
    }
  }  


  //console.log('cart:');
  //console.log({cart});

  /*for (const item of cart.items) {
    //throw new ReactionError("invalid", `"${item._id}"`);
    //const { id: productId } = decodeOpaqueId(item._id);
    if (discountMethod.conditions.products && Array.isArray(discountMethod.conditions.products)) {
      const { id: productId } = decodeOpaqueId(discountMethod.conditions.products[0]);
      throw new ReactionError("invalid", `"${productId}"`);
      //throw new ReactionError("invalid", `"${item._id}"`);
      //throw new ReactionError("invalid", `"${productId}"`);
      if (discountMethod.conditions.products.includes(item._id)) {     
        discount += item.subtotal.amount * discountAmount / 100;
      }
    } else {
      discount += item.subtotal.amount * discountAmount / 100;
    }
  }*/

  return discount;
}
