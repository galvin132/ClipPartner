import type { Product } from "./domain";

export type ProductValidity = {
  isValid: boolean;
  reason: string;
  product?: Product;
};

export function getProductValidity(
  products: Product[],
  productName: string,
  platform?: Product["platform"]
): ProductValidity {
  const normalizedName = productName.trim();
  const product = products.find((item) => item.name === normalizedName && (!platform || item.platform === platform));

  if (!normalizedName || normalizedName === "待绑定商品") {
    return { isValid: false, reason: "未绑定精选联盟商品" };
  }

  if (!product) {
    return { isValid: false, reason: "商品不存在或平台不匹配" };
  }

  if (!product.isActive) {
    return { isValid: false, reason: "商品已停用" };
  }

  if (!/^https?:\/\//i.test(product.affiliateUrl)) {
    return { isValid: false, reason: "商品推广链接无效" };
  }

  if (product.commissionRate <= 0 || product.commissionRate > 100) {
    return { isValid: false, reason: "商品佣金比例无效" };
  }

  return { isValid: true, reason: "商品有效", product };
}

export function isProductValid(products: Product[], productName: string, platform?: Product["platform"]) {
  return getProductValidity(products, productName, platform).isValid;
}
