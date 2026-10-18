import type { DeviceProfile, DeviceStats } from "@neko-master/shared";

export function filterDevices(devices: DeviceStats[], profiles: DeviceProfile[] | undefined, search: string, group: string): DeviceStats[] {
  const metadata = new Map(profiles?.map(profile => [profile.sourceIP, profile]));
  const term = search.trim().toLocaleLowerCase();
  return devices.map(device => {
    const profile = metadata.get(device.sourceIP);
    return profiles ? { ...device, displayName: profile?.displayName ?? "", groupName: profile?.groupName ?? "" } : device;
  }).filter(device =>
    (!term || [device.sourceIP, device.displayName, device.groupName].some(value => value?.toLocaleLowerCase().includes(term))) &&
    (group === "all" || (group === "ungrouped" ? !device.groupName : device.groupName === group.slice(6))),
  ).sort((a, b) => b.totalDownload + b.totalUpload - a.totalDownload - a.totalUpload);
}
