declare module "qrcode" {
  interface QRCodeModules {
    size: number;
    data: ArrayLike<number | boolean>;
  }
  interface QRCodeObject {
    modules: QRCodeModules;
    version: number;
  }
  const QRCode: {
    create(text: string, options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" }): QRCodeObject;
  };
  export default QRCode;
}
