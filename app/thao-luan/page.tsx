import FeedExplorer from "@/components/FeedExplorer";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cluster?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <FeedExplorer
      mode="discussions"
      initialCluster={typeof params.cluster === "string" ? params.cluster : ""}
    />
  );
}
