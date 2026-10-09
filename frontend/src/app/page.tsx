"use client";

import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

const packages = [
  { id: "PKG-1042", destination: "Baku", lane: "LANE A", confidence: 98, status: "Sorted", time: "12:42:08" },
  { id: "PKG-1043", destination: "Ganja", lane: "LANE B", confidence: 96, status: "Sorted", time: "12:42:11" },
  { id: "PKG-1044", destination: "Baku", lane: "—", confidence: 62, status: "Review", time: "12:42:15" },
  { id: "PKG-1045", destination: "Sumqayit", lane: "LANE C", confidence: 94, status: "Sorted", time: "12:42:19" },
  { id: "PKG-1046", destination: "Unknown", lane: "—", confidence: 41, status: "Review", time: "12:42:23" },
];

const lanes = [
  { name: "LANE A", city: "Baku", count: 128, color: "#38bdf8" },
  { name: "LANE B", city: "Ganja", count: 86, color: "#a78bfa" },
  { name: "LANE C", city: "Sumqayit", count: 64, color: "#34d399" },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [livePackages, setLivePackages] = useState<
  {
    id: string;
    destination: string;
    lane: string;
    confidence: number;
    status: string;
    time: string;
  }[]
>([]);
  const [filter, setFilter] = useState("All");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  useEffect(() => {
  async function checkApi() {
    try {
      const response = await fetch(`${API_URL}/api/sorting/health`);
      setApiOnline(response.ok);
    } catch {
      setApiOnline(false);
    }
  }

  checkApi();
  const interval = setInterval(checkApi, 10000);

  return () => clearInterval(interval);
}, []);

  const [testPackageId, setTestPackageId] = useState("PKG-TEST-001");
  const [trackingNumber, setTrackingNumber] = useState("AZ123456");
  const [destination, setDestination] = useState("Baku");
  const [confidence, setConfidence] = useState("0.97");
  const [issues, setIssues] = useState("");
  const [sortingResult, setSortingResult] = useState<{
    package_id: string;
    destination: string | null;
    status: string;
    decision: {
      action: string;
      lane: string | null;
      reason: string;
    };
  } | null>(null);
  const [sortingLoading, setSortingLoading] = useState(false);
  const [sortingError, setSortingError] = useState("");

  async function testSorting() {
    setSortingLoading(true);
    setSortingError("");
    setSortingResult(null);

    try {
      const response = await fetch(`${API_URL}/api/sorting/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_id: testPackageId,
          tracking_number: trackingNumber || null,
          destination: destination || null,
          issues: issues.trim()
            ? issues.split(",").map((issue) => issue.trim()).filter(Boolean)
            : [],
          confidence: confidence.trim() === "" ? null : Number(confidence),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error("The sorting API rejected the request.");
      }

      setSortingResult(data);

      setLivePackages((previous) => [
  {
        id: data.package_id,
        destination: data.destination ?? "Unknown",
        lane: data.decision.lane ?? "—",
        confidence: Math.round(Number(confidence) * 100),
        status: data.status === "SORT" ? "Sorted" : "Review",
        time: new Date().toLocaleTimeString(),
  },
  ...previous.filter((pkg) => pkg.id !== data.package_id),
]);
    } catch (error) {
      setSortingError(
        error instanceof Error
          ? error.message
          : "Could not connect to the sorting API."
      );
    } finally {
      setSortingLoading(false);
    }
  }


  const allPackages = [...livePackages, ...packages];

  const visiblePackages = allPackages.filter((pkg) => {
  if (filter === "Review") {
    return pkg.status === "Review" && !reviewed.includes(pkg.id);
  }
  if (filter === "Sorted") return pkg.status === "Sorted";
  return true;
});


  const reviewCount = allPackages.filter(
  (pkg) => pkg.status === "Review" && !reviewed.includes(pkg.id)
  ).length;

  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.07] bg-[#0c111d] p-6 md:flex md:flex-col">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-slate-950">
              S
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">SortSight<span className="text-cyan-400"> AI</span></div>
              <div className="text-xs text-slate-500">SORTING INTELLIGENCE</div>
            </div>
          </div>

          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
            Workspace
          </div>
          <nav className="space-y-2">
            {[
              ["◫", "Overview"],
              ["▦", "Package flow"],
              ["◎", "Manual review"],
              ["⌁", "Analytics"],
            ].map(([icon, name]) => (
              <button
                key={name}
                onClick={() => {
                  setActiveTab(name);
                  if (name === "Manual review") setFilter("Review");
                  else if (name === "Package flow") setFilter("All");
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                  activeTab === name
                    ? "bg-cyan-400/10 font-semibold text-cyan-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-lg">{icon}</span>
                {name}
                {name === "Manual review" && reviewCount > 0 && (
                  <span className="ml-auto rounded-md bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">
                    {reviewCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              System status
            </div>
            <p className="text-xs leading-5 text-slate-500">
  {apiOnline
    ? "Sorting API connected and responding."
    : "Sorting API offline or unreachable."}
</p>
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-slate-500">Environment</span>
              <span className="text-slate-300">Development</span>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-8">
            <div>
              <div className="text-xs text-slate-500">Workspace / {activeTab}</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {activeTab === "Overview" ? "Operations overview" : activeTab}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span
  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
    apiOnline
      ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
      : "border-amber-400/20 bg-amber-400/[0.06] text-amber-300"
  }`}
>
  <span
    className={`h-2 w-2 rounded-full ${
      apiOnline ? "bg-emerald-400" : "bg-amber-400"
    }`}
  />
  {apiOnline ? "API online" : "API offline"}
</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold">
                OP
              </div>
            </div>
          </header>

          <div className="space-y-8 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Here&apos;s what&apos;s happening at the sorting center.</p>
                <p className="mt-1 text-xs text-slate-600">DEMO DATA · SAMPLE PACKAGES</p>
              </div>
              <button
                onClick={() => {
                  setFilter("All");
                  setActiveTab("Overview");
                  setNotice("Overview restored.");
                }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                ↻ Reset view
              </button>
            </div>


            <section className="rounded-2xl border border-cyan-400/20 bg-[#101725] p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Test package sorting</h2>
              <p className="mt-1 text-sm text-slate-400">
                Send a package to the live sorting API.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">
                  Package ID
                  <input value={testPackageId} onChange={(e) => setTestPackageId(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#090d16] p-3 text-white" />
                </label>
                <label className="text-sm text-slate-300">
                  Tracking number
                  <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#090d16] p-3 text-white" />
                </label>
                <label className="text-sm text-slate-300">
                  Destination
                  <select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#090d16] p-3 text-white">
                    <option value="Baku">Baku</option>
                    <option value="Ganja">Ganja</option>
                    <option value="Sumqayit">Sumqayit</option>
                    <option value="Unknown">Unknown destination</option>
                  </select>
                </label>
                <label className="text-sm text-slate-300">
                  Confidence (0 to 1)
                  <input type="number" min="0" max="1" step="0.01" value={confidence} onChange={(e) => setConfidence(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#090d16] p-3 text-white" />
                </label>
                <label className="text-sm text-slate-300 sm:col-span-2">
                  Inspection issues (comma-separated, if any)
                  <input value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="e.g. damaged label, unreadable barcode" className="mt-2 w-full rounded-lg border border-white/10 bg-[#090d16] p-3 text-white" />
                </label>
              </div>

              <button onClick={testSorting} disabled={sortingLoading} className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">
                {sortingLoading ? "Checking..." : "Run sorting decision"}
              </button>

              {sortingError && <p className="mt-4 text-sm text-red-300">{sortingError}</p>}

              {sortingResult && (
                <div className="mt-5 rounded-xl border border-white/10 bg-[#090d16] p-4">
                  <p className="font-semibold text-cyan-300">
                    Result: {sortingResult.status}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Lane: {sortingResult.decision.lane ?? "Manual review"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {sortingResult.decision.reason}
                  </p>
                </div>
              )}
            </section>
            {notice && (
              <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-200">
                {notice}
                <button onClick={() => setNotice("")} aria-label="Dismiss notification">✕</button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Packages processed", value: "1,284", change: "+12.8%", icon: "▤", color: "text-cyan-300" },
                { label: "Successfully sorted", value: "1,196", change: "93.2% of total", icon: "✓", color: "text-emerald-300" },
                { label: "Needs review", value: String(reviewCount), change: "Requires attention", icon: "◎", color: "text-amber-300" },
                { label: "Avg. AI confidence", value: "94.6%", change: "Target ≥ 85%", icon: "⌁", color: "text-violet-300" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-[#101725] p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{stat.label}</span>
                    <span className={`text-xl ${stat.color}`}>{stat.icon}</span>
                  </div>
                  <div className="mt-5 text-3xl font-semibold tracking-tight">{stat.value}</div>
                  <div className={`mt-2 text-xs ${stat.color}`}>{stat.change}</div>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-white/[0.08] bg-[#101725] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Conveyor & sorting lanes</h2>
                  <p className="mt-1 text-sm text-slate-500">Destination-based package routing</p>
                </div>
                <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">3 active lanes</span>
              </div>

              <div className="my-7 flex items-center gap-3">
                <div className="flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07]">
                  <span className="text-xl text-cyan-300">▣</span>
                  <span className="mt-1 text-[10px] font-bold tracking-widest text-cyan-200">SCANNER</span>
                </div>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-700/70">
                  <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-gradient-to-r from-cyan-400/30 to-cyan-300" />
                  <div className="absolute inset-0 flex items-center justify-around">
                    {[0, 1, 2, 3, 4].map((dot) => (
                      <span key={dot} className="h-3 w-3 rounded-full border-2 border-[#101725] bg-cyan-300" />
                    ))}
                  </div>
                </div>
                <div className="flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <span className="text-xl">⇢</span>
                  <span className="mt-1 text-[10px] font-bold tracking-widest text-slate-400">ROUTER</span>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {lanes.map((lane) => (
                  <div key={lane.name} className="rounded-xl border border-white/[0.07] bg-[#0b111d] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold tracking-widest" style={{ color: lane.color }}>{lane.name}</div>
                        <div className="mt-1 text-lg font-semibold">{lane.city}</div>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-lg">⇢</div>
                    </div>
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-semibold">{lane.count}</div>
                        <div className="mt-1 text-xs text-slate-500">Packages today</div>
                      </div>
                      <span className="text-xs text-emerald-300">● Active</span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${(lane.count / 150) * 100}%`, backgroundColor: lane.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101725]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-semibold">Package activity</h2>
                  <p className="mt-1 text-sm text-slate-500">Recent inspection and routing decisions</p>
                </div>
                <div className="flex gap-1 rounded-lg bg-[#090d16] p-1">
                  {["All", "Sorted", "Review"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-md px-3 py-2 text-xs transition ${
                        filter === item ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Package ID</th>
                      <th className="px-6 py-4 font-medium">Destination</th>
                      <th className="px-6 py-4 font-medium">Confidence</th>
                      <th className="px-6 py-4 font-medium">Lane</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {visiblePackages.map((pkg) => {
                      const isReviewed = reviewed.includes(pkg.id);
                      return (
                        <tr key={pkg.id} className="hover:bg-white/[0.02]">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-200">{pkg.id}</div>
                            <div className="mt-1 text-xs text-slate-600">{pkg.time}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">{pkg.destination}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="w-10 text-slate-300">{pkg.confidence}%</span>
                              <div className="h-1.5 w-16 rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pkg.confidence}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400">{pkg.lane}</td>
                          <td className="px-6 py-4">
                            {pkg.status === "Sorted" ? (
                              <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">✓ Sorted</span>
                            ) : isReviewed ? (
                              <span className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-300">Reviewed</span>
                            ) : (
                              <button
                                onClick={() => {
                                                                                setReviewed((previous) =>
                                                                                     previous.includes(pkg.id) ? previous : [...previous, pkg.id]
  );
  setNotice(`${pkg.id} marked as reviewed.`);
}}
                                className="rounded-full bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-400/20"
                              >
                                Review →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {visiblePackages.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">No packages match this filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-white/[0.06] px-6 py-4 text-xs text-slate-500">
                Showing {visiblePackages.length} sample packages · Review actions are currently demo-only
              </div>
            </section>

            <footer className="flex flex-wrap justify-between gap-2 pb-3 text-xs text-slate-600">
              <span>SortSight AI · Operations dashboard</span>
              <span>Hackathon prototype · Demo data, not live warehouse metrics</span>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

