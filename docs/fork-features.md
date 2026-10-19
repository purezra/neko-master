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

Device cards in **Compare** also open a domain comparison dialog for the exact two displayed periods. The dialog includes increased, decreased, unchanged, new, and historical-only domains, ordered by absolute traffic change. Search and the growth/decline/new filters operate on the complete union before pagination (20 rows per page); totals always cover all recorded domains for that device, excluding traffic without a domain name. Queries remain isolated by gateway and device IP, with SQLite/ClickHouse parity and the same retention and complete-bucket limits as the parent comparison.

## Daily history from the overview

With **7d**, **30d**, or a custom range of at least 48 hours selected, each popular domain, proxy and country row opens a daily traffic dialog (also via Enter/Space). A seven-day selection contains seven connected points; thirty days contains thirty. The dialog includes per-point upload/download totals, exact interval tooltips, a data table, retry and no-data states.

Intervals are consecutive 24-hour windows anchored at the selected start, rather than calendar-midnight buckets. A trailing partial day gets its own point. Query boundaries are rounded down to complete UTC hours, matching the saved hourly facts and excluding the still-open hour. Missing historical intervals are zero-filled; retention still limits available data. Queries support up to 366 days. Proxy grouping uses the same first hop as the overview. SQLite and ClickHouse both support all three dimensions without new tables or changes to traffic ingestion.

## Export formatting

Export dates and filenames use Asia/Shanghai (UTC+08:00), independent of the browser/server time zone. Filenames identify the gateway, actual statistics interval and export time. Excel dates store Beijing wall-clock values with an explicit UTC+08:00 display format; CSV/JSON timestamps retain the same instant with a +08:00 offset. Excel/CSV traffic values use KB below 1 MiB and MB below 1 GiB (two fixed decimals), then GB (four fixed decimals). Counts stay numeric; JSON byte fields retain raw bytes for processing.

## Branding and deployment

The Next.js development indicator and the React Query developer-panel launcher are hidden so they do not overlap application controls. Development compilation and runtime errors remain visible through Next.js error reporting.

The custom icon is generated into the page logo, favicon and regular/maskable PWA icons. To regenerate it, run `node scripts/generate-icons.mjs <source.png>` from `apps/web`. Versioned asset URLs prevent old icon caches from masking the update.

After pulling this fork, rebuild both apps and restart the collector as well as the web app. For deployments, use the documented production build/start flow rather than `pnpm dev`. The theme palette hook uses a stable initial hydration snapshot so saved light/system preferences cannot change the initial icon markup.
