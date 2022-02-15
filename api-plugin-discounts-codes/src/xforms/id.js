import decodeOpaqueIdForNamespace from "@reactioncommerce/api-utils/decodeOpaqueIdForNamespace.js";
import encodeOpaqueId from "@reactioncommerce/api-utils/encodeOpaqueId.js";

const namespaces = {
  Cart: "reaction/cart",
  Discount: "reaction/discount",
  Shop: "reaction/shop",
  CartItem: "reaction/cartItem"
};

export const encodeCartOpaqueId = encodeOpaqueId(namespaces.Cart);
export const encodeDiscountOpaqueId = encodeOpaqueId(namespaces.Discount);
export const encodeShopOpaqueId = encodeOpaqueId(namespaces.Shop);
export const encodeCartItemOpaqueId = encodeOpaqueId(namespaces.CartItem);

export const decodeCartOpaqueId = decodeOpaqueIdForNamespace(namespaces.Cart);
export const decodeDiscountOpaqueId = decodeOpaqueIdForNamespace(namespaces.Discount);
export const decodeShopOpaqueId = decodeOpaqueIdForNamespace(namespaces.Shop);
export const decodeCartItemOpaqueId = decodeOpaqueIdForNamespace(namespaces.CartItem);
