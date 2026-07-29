import StatsCard from '../StatsCard';
import { Package, TrendingUp, Users } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      <StatsCard
        title="Total Orders"
        value={24}
        icon={Package}
        description="Active deliveries"
      />
      <StatsCard
        title="Revenue"
        value="45M"
        icon={TrendingUp}
        description="+12% from last month"
      />
      <StatsCard
        title="Clients"
        value={156}
        icon={Users}
        description="Registered this month"
      />
    </div>
  );
}
