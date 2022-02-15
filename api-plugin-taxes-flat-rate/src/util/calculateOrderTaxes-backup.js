import Random from "@reactioncommerce/random";

import https from "https";

const TAX_SERVICE_NAME = "custom-rates";

async function getAvalaraRate(order) {
  const { shippingAddress } = order;

  let pathStr = '/api/v2/taxrates/byaddress?';

  if (shippingAddress.address1) {
    pathStr += 'line1=';
    pathStr += shippingAddress.address1;
    pathStr += '&';
  }
    
  if (shippingAddress.address2) {
    pathStr += 'line2=';
    pathStr += shippingAddress.address2;
    pathStr += '&';
  }

  if (shippingAddress.city) {
    pathStr += 'city=';
    pathStr += shippingAddress.city;
    pathStr += '&';
  }
  
  if (shippingAddress.region) {
    pathStr += 'region=';
    pathStr += shippingAddress.region;
    pathStr += '&';
  }

  if (shippingAddress.postal) {
    pathStr += 'postalCode=';
    pathStr += shippingAddress.postal;
    pathStr += '&';
  }

  if (shippingAddress.country) {
    pathStr += 'country=';
    pathStr += shippingAddress.country;
    pathStr += '&';
  }   
  
  let pathQuery = '';
    
  if (pathStr.slice(-1) == '&') {
    pathQuery = pathStr.slice(0, -1).replace(/ /g, '%20').trim().replace(/\s\s+/g, " ");
  } else {
    pathQuery = pathStr.replace(/ /g, '%20').trim().replace(/\s\s+/g, " ");
  }
    
  let options = {
    hostname: 'rest.avatax.com',
    path: pathQuery,
    method: 'GET',
    headers: {
      Authorization: 'Basic am9obmp0cm9ub2xvbmVAZ21haWwuY29tOnVidW50dTJ2Y3B1'
    }
  }

  let r = 0;

  //const calculatedAvalaraRate = await https.get(options, (res) => {
  await https.get(options, (res) => {
    let data = '';
      
    res.on('data', (chunk) => {
      data += chunk;
    });
      
    res.on('end', () => {
      let json;
      try { 
        json = JSON.parse(data);
      } catch (err) {
        console.log(err.message);
      }
      //console.log(json);
      //let avalaraRate = 0;
      if (json.totalRate) {
        //avalaraRate = json.totalRate;
        r = json.totalRate;
        //console.log('TODO delete : AvalaraRate: ' + avalaraRate);
        console.log('TODO delete : JSONRate: ' + json.totalRate);
      }
      //return avalaraRate;
      //return 1.1;
    });
  }).on('error', (err) => {
    console.log('Tax Service Error: ' + err.message);
  });
  return r; 
  //console.log("calculatedAvalaraRate: ");
  //console.log(calculatedAvalaraRate);
  //return calculatedAvalaraRate;
  //return 1.1;
  //return r;
}

/**
 * @summary Gets all applicable tax definitions based on shop ID and shipping
 *   or origin address of a fulfillment group
 * @param {Object} collections Map of MongoDB collections
 * @param {Object} order The order
 * @returns {Object[]} Array of tax definition docs
 */
async function getTaxesForShop(collections, order) {
  const { Taxes } = collections;
  const { originAddress, shippingAddress, shopId } = order;

  const orArray = [];


  if (shippingAddress) {
    orArray.push({
      taxLocale: "destination",
      $or: [{
        postal: shippingAddress.postal,
        country: shippingAddress.country
      }, {
        region: shippingAddress.region,
        country: shippingAddress.country,
      }, {
        postal: shippingAddress.postal
      }, {
        postal: null,
        region: shippingAddress.region,
        country: shippingAddress.country
      }, {
        postal: null,
        region: null,
        country: shippingAddress.country
      }, {
        postal: null,
        region: null,
        country: null
      }]
    });
  }

  if (originAddress) {
    orArray.push({
      taxLocale: "origin",
      $or: [{
        postal: originAddress.postal
      }, {
        postal: null,
        region: originAddress.region,
        country: originAddress.country
      }, {
        postal: null,
        region: null,
        country: originAddress.country
      }, {
        postal: null,
        region: null,
        country: null
      }]
    });
  }

  // Find all defined taxes where the shipping address is a match
  const taxDocs = await Taxes.find({
    shopId,
    $or: orArray
  }).toArray();
      
    // Rate is entered and stored in the database as a percent. Convert to ratio.
    // Also add a name. Someday should allow a shop operator to enter the name.
    /*return taxDocs.map((doc) => ({
      ...doc,
      rate: doc.rate / 100,
      name: `${doc.postal || ""} ${doc.region || ""} ${doc.country || ""}`.trim().replace(/\s\s+/g, " ")
    }));*/
  return taxDocs.map((doc) => ({
    ...doc,
    rate: doc.rate / 100,
    name: `${doc.postal || ""} ${doc.region || ""} ${doc.country || ""}`.trim().replace(/\s\s+/g, " ")
  }));
}


/**
 * @summary Calculate and return taxes for an order
 * @param {Object} context App context
 * @param {Object} [cart] The original cart object, if CommonOrder was built from a cart
 * @param {Object} order The CommonOrder
 * @returns {Object|null} Calculated tax information, in `TaxServiceResult` schema, or `null` if can't calculate
 */
export default async function calculateOrderTaxes({ context, order }) {
  const { items, originAddress, shippingAddress } = order;

  if (!shippingAddress && !originAddress) return null;

  //const avalaraTaxRate = await getAvalaraRate(order);

  const allTaxes = await getTaxesForShop(context.collections, order);

  //function getAvalaraRateForItem() {
    
    //return avalaraTaxRate;
  //}

  /**
   * @param {Object} item The item
   * @returns {Object[]} applicable taxes for one item, in the `taxes` schema
   */
  function taxesForItem(item, rateOverride) {
    if (!item.isTaxable) return [];
    
    //const newRate = getAvalaraRateForItem();
    
    return allTaxes
      .filter((taxDef) => !taxDef.taxCode || taxDef.taxCode === item.taxCode)
      .map((taxDef) => ({
        _id: Random.id(),
        jurisdictionId: taxDef._id,
        sourcing: taxDef.taxLocale,
        tax: item.subtotal.amount * taxDef.rate,
        taxableAmount: item.subtotal.amount,
        taxName: taxDef.name,
        taxRate: rateOverride // taxDef.rae
      }));
  }

  const apiRate = await getAvalaraRate(order).catch((err) => { console.error(err); });
  console.log(apiRate);

  // calculate line item taxes
  let totalTaxableAmount = 0;
  let totalTax = 0;
  const groupTaxes = {};
  const itemTaxes = items.map((item) => {

    const taxes = taxesForItem(item, apiRate);

    // Update the group taxes list
    taxes.forEach((taxDef) => {
      const { jurisdictionId } = taxDef;
      if (groupTaxes[jurisdictionId]) {
        groupTaxes[jurisdictionId].tax += taxDef.tax;
        groupTaxes[jurisdictionId].taxableAmount += taxDef.taxableAmount;
      } else {
        groupTaxes[jurisdictionId] = {
          ...taxDef,
          _id: Random.id()
        };
      }
    });

    // The taxable amount for the item as a whole is the maximum amount that was
    // taxed by any of the found tax jurisdictions.
    const itemTaxableAmount = taxes.reduce((maxTaxableAmount, taxDef) => {
      if (taxDef.taxableAmount > maxTaxableAmount) return taxDef.taxableAmount;
      return maxTaxableAmount;
    }, 0);
    totalTaxableAmount += itemTaxableAmount;

    // The tax for the item as a whole is the sum of all applicable taxes.
    const itemTax = taxes.reduce((sum, taxDef) => sum + taxDef.tax, 0);
    totalTax += itemTax;

    /*let pathStr = '/api/v2/taxrates/byaddress?';

    if (shippingAddress.address1) {
      pathStr += 'line1=';
      pathStr += shippingAddress.address1;
      pathStr += '&';
    }
    
    if (shippingAddress.address2) {
      pathStr += 'line2=';
      pathStr += shippingAddress.address2;
      pathStr += '&';
    }

    if (shippingAddress.city) {
      pathStr += 'city=';
      pathStr += shippingAddress.city;
      pathStr += '&';
    }
  
    if (shippingAddress.region) {
      pathStr += 'region=';
      pathStr += shippingAddress.region;
      pathStr += '&';
    }

    if (shippingAddress.postal) {
      pathStr += 'postalCode=';
      pathStr += shippingAddress.postal;
      pathStr += '&';
    }

    if (shippingAddress.country) {
      pathStr += 'country=';
      pathStr += shippingAddress.country;
      pathStr += '&';
    }
   
    let pathQuery = '';
    
    if (pathStr.slice(-1) == '&') {
      pathQuery = pathStr.slice(0, -1).replace(/ /g, '%20').trim().replace(/\s\s+/g, " ");
    } else {
      pathQuery = pathStr.replace(/ /g, '%20').trim().replace(/\s\s+/g, " ");
    }
    
    console.log(pathQuery);

    let options = {
      hostname: 'rest.avatax.com',
      path: pathQuery,
      method: 'GET',
      headers: {
        Authorization: 'Basic am9obmp0cm9ub2xvbmVAZ21haWwuY29tOnVidW50dTJ2Y3B1'
      }
    }

    https.get(options, (res) => {

      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(data);
      });
    }).on('error', (err) => {
      console.log('Tax Service Error: ' + err.message);
  
    });*/


    return {
      itemId: item._id,
      tax: itemTax,
      taxableAmount: itemTaxableAmount,
      taxes
    };
  });
  
  
  // Eventually tax shipping as and where necessary here. Not yet implemented.

  return {
    itemTaxes,
    taxSummary: {
      calculatedAt: new Date(),
      calculatedByTaxServiceName: TAX_SERVICE_NAME,
      tax: totalTax,
      taxableAmount: totalTaxableAmount,
      taxes: Object.values(groupTaxes)
    }
  };
}
