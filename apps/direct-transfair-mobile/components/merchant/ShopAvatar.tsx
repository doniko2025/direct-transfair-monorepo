// apps/direct-transfair-mobile/components/merchant/ShopAvatar.tsx
// Pastille du commerce : son logo s'il en a un (lot 13), sinon ses initiales. Utilisée partout où un commerce apparaît.

import React from "react";
import { Avatar } from "../ui";
import { useMerchantLogo } from "../../hooks/useMerchantLogo";

export function ShopAvatar({
  shopId, version, name, size = 44,
}: { shopId?: string | null; version?: string | null; name?: string; size?: number }) {
  const uri = useMerchantLogo(shopId, version);
  return <Avatar name={name} size={size} uri={uri} icon={!uri && !name ? "storefront-outline" : undefined} />;
}

export default ShopAvatar;
