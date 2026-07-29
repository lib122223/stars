import { notFound } from "next/navigation";
import BodyMapViewer from "@/features/tools/body-map-viewer";
import { bodyMaps, getBodyMapConfig, type BodyMapSlug } from "@/lib/astronomy/body-map-data";

export function generateStaticParams() {
  return Object.keys(bodyMaps).map((body) => ({ body }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ body: string }>;
}) {
  const { body } = await params;
  const config = getBodyMapConfig(body);
  if (!config) {
    return { title: "3D 天体地貌地图 | Echo of Photons" };
  }
  return {
    title: `3D ${config.nameZh}地貌地图 | Echo of Photons`,
    description: `${config.nameZh}的 3D 地貌地图，展示${config.subtitle}`,
  };
}

export default async function BodyMapPage({
  params,
}: {
  params: Promise<{ body: BodyMapSlug }>;
}) {
  const { body } = await params;
  const config = getBodyMapConfig(body);
  if (!config) notFound();

  return <BodyMapViewer key={config.slug} config={config} />;
}
