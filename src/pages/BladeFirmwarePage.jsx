import { PageHeader } from '../components/ui';
import BladeFirmwarePanel from '../components/BladeFirmwarePanel';

function BladeFirmwarePage() {
  return (
    <>
      <PageHeader
        title="Blade Firmware"
        subtitle="Running firmware versions across all blades, by domain and model"
      />
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <BladeFirmwarePanel />
      </main>
    </>
  );
}

export default BladeFirmwarePage;
