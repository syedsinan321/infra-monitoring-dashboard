import { useState } from 'react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import SummaryCards from '../components/SummaryCards';
import DomainWidgets from '../components/DomainWidgets';
import ChassisSection from '../components/ChassisSection';
import FabricInterconnectSection from '../components/FabricInterconnectSection';
import NetworkSwitchesSection from '../components/NetworkSwitchesSection';
import ServerProfilesSection from '../components/ServerProfilesSection';
import { domainWidgetsData } from '../mockData';
import { ChevronDown, ChevronRight } from 'lucide-react';

function DashboardPage({ data, onRefresh }) {
  const [lastUpdated] = useState(new Date());
  const [sections, setSections] = useState({
    domains: true,
    chassis: true,
    fis: true,
    switches: true,
    profiles: false,
  });

  const toggleSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!data) return null;

  const SectionHeader = ({ title, sectionKey, count }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center space-x-2 mb-4 group"
    >
      {sections[sectionKey] ? (
        <ChevronDown className="h-5 w-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
      ) : (
        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-200 transition-colors" />
      )}
      <h2 className="text-lg font-semibold group-hover:text-blue-400 transition-colors">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-slate-500 dark:text-slate-400">({count})</span>
      )}
    </button>
  );

  return (
    <>
      <Header onRefresh={onRefresh} lastUpdated={lastUpdated} autoRefresh={false} />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Search */}
        <SearchBar
          chassis={data.chassis}
          blades={data.blades}
          fabricInterconnects={data.fabric_interconnects}
          switches={data.network_switches}
          profiles={data.profiles}
        />

        {/* Summary Cards */}
        <SummaryCards summary={data.summary} />

        {/* Domain Overview */}
        <div>
          <SectionHeader title="Domain Overview" sectionKey="domains" count={domainWidgetsData.length} />
          {sections.domains && <DomainWidgets domains={domainWidgetsData} />}
        </div>

        {/* Chassis & Blades */}
        <div>
          <SectionHeader title="Chassis & Blade Utilization" sectionKey="chassis" count={data.chassis?.length} />
          {sections.chassis && (
            <ChassisSection chassis={data.chassis} blades={data.blades} />
          )}
        </div>

        {/* Fabric Interconnects */}
        <div>
          <SectionHeader title="Fabric Interconnects" sectionKey="fis" count={data.fabric_interconnects?.length} />
          {sections.fis && (
            <FabricInterconnectSection fabricInterconnects={data.fabric_interconnects} />
          )}
        </div>

        {/* Network Switches */}
        <div>
          <SectionHeader title="Network Switches" sectionKey="switches" count={data.network_switches?.length} />
          {sections.switches && (
            <NetworkSwitchesSection switches={data.network_switches} />
          )}
        </div>

        {/* Server Profiles */}
        <div>
          <SectionHeader title="Server Profiles" sectionKey="profiles" count={data.profiles?.length} />
          {sections.profiles && (
            <ServerProfilesSection
              profiles={data.profiles}
              blades={data.blades}
              chassis={data.chassis}
            />
          )}
        </div>
      </main>
    </>
  );
}

export default DashboardPage;
