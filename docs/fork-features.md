# Fork features

This fork is maintained at https://github.com/purezra/neko-master. The About dialog links to this repository and checks its published GitHub releases. The original project remains credited separately.

## Device names and groups

- Open **Devices → Names & groups** to assign a display name and one optional group to an observed device IP.
- Search by IP, name or group, or select a group. Charts display up to 100 matching devices; **Export filtered devices** exports the complete filtered result returned by the devices API (up to 2,000 devices).
- Device names and groups are also included in the main data export.
- Metadata is scoped by gateway and IP, not MAC address. DHCP address changes require reassignment.
- `device_profiles` is SQLite configuration, independent of traffic retention and ClickHouse traffic storage. Clearing traffic preserves profiles; deleting a gateway explicitly deletes them. Both SQLite and ClickHouse reads attach this metadata after traffic aggregation.
- The table is created idempotently by `database/schema.ts` on existing and new databases. The probe protocol and traffic write path are unchanged.

## Period comparison

**Compare** supports today/yesterday, this week/last week (Monday start), and a selected period/its preceding period. Calendar presets use the browser's local time zone and compare equal elapsed durations. The exact queried ranges are displayed.

Results use saved, complete minute buckets for periods up to six hours, and UTC hour buckets for longer periods. Ends are exclusive. Windows must have equal durations, must not overlap, and may span at most 31 days. Missing retained history cannot be reconstructed; configure retention to cover both periods.

Summary changes and the ten largest device/domain increases are calculated over the full aggregated population. Rankings are not derived from independently truncated Top N lists. SQLite and ClickHouse have equivalent growth queries; partial ClickHouse results fall back together unless strict mode forbids fallback.

## Branding and deployment

The custom icon is generated into the page logo, favicon and regular/maskable PWA icons. To regenerate it, run `node scripts/generate-icons.mjs <source.png>` from `apps/web`. Versioned asset URLs prevent old icon caches from masking the update.

After pulling this fork, rebuild both apps and restart the collector as well as the web app. For deployments, use the documented production build/start flow rather than `pnpm dev`. The theme palette hook uses a stable initial hydration snapshot so saved light/system preferences cannot change the initial icon markup.
