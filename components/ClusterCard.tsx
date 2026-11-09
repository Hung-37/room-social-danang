import Link from 'next/link';
import { memo } from 'react';
import type { Cluster } from '@/lib/data';

function ClusterCard({ cluster }: { cluster: Cluster }) {
  return (
    <Link href={`/cum/${cluster.id}`} className={`cluster-card ${cluster.accent}`}>
      <div className="cluster-top">
        <span className="cluster-pin">⌾</span>
        <span className="cluster-badge">Cộng đồng</span>
      </div>
      <h3>{cluster.name}</h3>
      <p>{cluster.short}</p>
      <div className="school-list">
        {cluster.schools.map((school) => <span key={school}>🎓 {school}</span>)}
      </div>
      <div className="cluster-stats">
        <span>Phòng: <b>Chưa có dữ liệu</b></span>
        <span>Thảo luận: <b>Chưa có dữ liệu</b></span>
        <span>Thành viên: <b>Chưa có dữ liệu</b></span>
      </div>
      <span className="card-arrow">→</span>
    </Link>
  );
}

export default memo(ClusterCard);
