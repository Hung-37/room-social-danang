import FeedExplorer from '@/components/FeedExplorer';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string|string[];cluster?:string|string[]}>}) {
 const params=await searchParams;
 return <FeedExplorer mode="rooms" initialQuery={typeof params.q==='string'?params.q:''} initialCluster={typeof params.cluster==='string'?params.cluster:''}/>;
}
