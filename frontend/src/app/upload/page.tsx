
"use client";

import { useState, useEffect } from "react";

interface InspectionResponse {
  package_id: string;
  tracking_number: string | null;
  destination: string | null;
  issues: string[];
  confidence: number | string | null;
  decision: {
    action: string;
    lane: string;
    reason: string;
  };
}

function isInspectionResponse(value: unknown): value is InspectionResponse {
  if (typeof value !== "object" || value === null) return false;

  const response = value as Record<string, unknown>;
  if (
    typeof response.package_id !== "string" ||
    !(response.tracking_number === null ||
      typeof response.tracking_number === "string") ||
    !(response.destination === null || typeof response.destination === "string") ||
    !Array.isArray(response.issues) ||
    !response.issues.every((issue) => typeof issue === "string") ||
    !(
      response.confidence === null ||
      typeof response.confidence === "number" ||
      typeof response.confidence === "string"
    ) ||
    typeof response.decision !== "object" ||
    response.decision === null
  ) {
    return false;
  }

  const decision = response.decision as Record<string, unknown>;
  return (
    typeof decision.action === "string" &&
    typeof decision.lane === "string" &&
    typeof decision.reason === "string"
  );
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InspectionResponse | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setResult(null);
    setError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Please select a JPG, PNG or WebP image.");
      setFile(null);
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError("Maximum file size is 5 MB.");
      setFile(null);
      return;
    }

    setFile(selected);
  }

  async function handleInspect() {
    if (!file || isLoading) return;

    setIsLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/inspection/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        throw new Error(
          response.ok
            ? "The server returned an invalid response."
            : `Inspection failed with status ${response.status}.`
        );
      }

      if (!response.ok) {
        const detail =
          typeof responseBody === "object" &&
          responseBody !== null &&
          "detail" in responseBody &&
          typeof responseBody.detail === "string"
            ? responseBody.detail
            : `Inspection failed with status ${response.status}.`;
        throw new Error(detail);
      }

      if (!isInspectionResponse(responseBody)) {
        throw new Error("The server returned an unexpected response.");
      }

      setResult(responseBody);

      // Save inspection results for the dashboard
      try {
        const previous = JSON.parse(
          localStorage.getItem("sortsight_inspections") || "[]"
        );

        const inspections = Array.isArray(previous) ? previous : [];

        localStorage.setItem(
          "sortsight_inspections",
          JSON.stringify([responseBody, ...inspections].slice(0, 50))
        );
      } catch (storageError) {
        console.error("Unable to save inspection history:", storageError);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to connect to the inspection service."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 font-semibold tracking-widest text-cyan-400">
          SORTSIGHT AI
        </p>

        <h1 className="text-4xl font-bold">
          Intelligent Package Inspection
        </h1>

        <p className="mt-4 text-slate-400">
          Upload a package image to analyze shipping information
          and identify potential delivery issues.
        </p>

        <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-600 p-10 text-center hover:border-cyan-400">
            <p className="text-lg font-medium">
              Select a package image
            </p>
            <p className="mt-2 text-sm text-slate-400">
              JPG, PNG or WebP — maximum 5 MB
            </p>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {preview && (
            <img
              src={preview}
              alt="Package preview"
              className="mt-6 max-h-80 w-full rounded-xl object-contain"
            />
          )}

          {error && (
            <p className="mt-4 text-red-400">{error}</p>
          )}

          <button
            type="button"
            onClick={handleInspect}
            disabled={!file || isLoading}
            className="mt-6 w-full rounded-xl bg-cyan-400 px-6 py-4 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40"
          >
            {isLoading ? "Inspecting..." : "Inspect Package"}
          </button>
        </section>

        {result && (
          <section
            aria-live="polite"
            className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-8"
          >
            <h2 className="text-2xl font-semibold text-cyan-400">
              Inspection Results
            </h2>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-400">Package ID</dt>
                <dd className="mt-1 break-all">{result.package_id}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Tracking number</dt>
                <dd className="mt-1">{result.tracking_number ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Destination</dt>
                <dd className="mt-1">{result.destination ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Confidence</dt>
                <dd className="mt-1">
                  {result.confidence === null
                    ? "Not available"
                    : result.confidence}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Decision action</dt>
                <dd className="mt-1">{result.decision.action}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Sorting lane</dt>
                <dd className="mt-1">{result.decision.lane}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-slate-400">Detected issues</dt>
                <dd className="mt-1">
                  {result.issues.length > 0 ? result.issues.join(", ") : "None"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-slate-400">Decision reason</dt>
                <dd className="mt-1">{result.decision.reason}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}
