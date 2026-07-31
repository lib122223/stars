export interface PhotoArGuide {
  id: string;
  target: {
    name: string;
    type: string;
    slug: string;
  };
  pointX: number;
  pointY: number;
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  capturedAt: string;
  captureAzimuth: number;
  capturePitch: number;
  targetAzimuth: number;
  targetAltitude: number;
}
