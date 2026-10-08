export const APP_ID = "6760237781";
export const PT = "128599477";

export type Campaign = "landing" | "qr" | "share";

export const appStoreUrl = (campaign: Campaign) =>
  `https://apps.apple.com/app/apple-store/id${APP_ID}?pt=${PT}&ct=${campaign}&mt=8`;
